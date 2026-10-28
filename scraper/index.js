const cron = require('node-cron');
const { scrapeLinkedIn } = require('./scrapers/linkedin');
const { scrapeRekrute } = require('./scrapers/rekrute');
const { scrapeIndeed } = require('./scrapers/indeed');
const { scrapeAlkhdma } = require('./scrapers/alkhdma');
const { scrapeEmploiPublic } = require('./scrapers/emploi_public');
const { sendMessage, startPolling, formatJobNotification } = require('./telegram');
const { appendToExcel, getRecentJobs, getAllJobs: getExcelHistoryJobs } = require('./excel');
const { fetchJobDescriptions } = require('./history');
const { analyzeJob } = require('./groq');
const { isNew, markSeen, getStats, getAllJobs: getDatabaseJobs } = require('./db');
const config = require('./config');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Store process PID for shutdown coordination
const pidFile = path.join(__dirname, '.bot.pid');
try {
  fs.writeFileSync(pidFile, String(process.pid));
} catch (_) {}

function removePidFile() {
  try {
    if (fs.existsSync(pidFile)) fs.unlinkSync(pidFile);
  } catch (_) {}
}

process.on('exit', removePidFile);
process.on('SIGINT', () => { removePidFile(); process.exit(0); });
process.on('SIGTERM', () => { removePidFile(); process.exit(0); });

let isScrapingRunning = false;
let isHistoryRunning = false;
let currentScheduleText = 'Tous les jours à 08:00 et 20:00 (Casablanca)';
let cronTask = null;

function setSchedule(cronExpr, textDesc) {
  if (cronTask) {
    cronTask.stop();
  }
  cronTask = cron.schedule(cronExpr, () => {
    console.log(`[Cron] Scheduled trigger fired (${textDesc})`);
    runScraper();
  }, {
    timezone: 'Africa/Casablanca'
  });
  currentScheduleText = textDesc;
  console.log(`[Scheduler] Cron scheduled: ${cronExpr} -> ${textDesc}`);
}

async function runScraper(options = {}) {
  if (isScrapingRunning) {
    console.log('[Scraper] Scraping already in progress. Skipping duplicate run.');
    if (options.chatId) {
      await sendMessage('⏳ Une recherche d\'offres est déjà en cours. Merci de patienter quelques instants.', options.chatId);
    }
    return;
  }

  isScrapingRunning = true;
  console.log(`[${new Date().toISOString()}] Scraping started...`);

  try {
    const linkedinJobs = await scrapeLinkedIn();
    const rekruteJobs = await scrapeRekrute();
    const indeedJobs = await scrapeIndeed();
    const alkhdmaJobs = await scrapeAlkhdma();
    const emploiPublicJobs = await scrapeEmploiPublic();

    const allJobs = [...linkedinJobs, ...rekruteJobs, ...indeedJobs, ...alkhdmaJobs, ...emploiPublicJobs];
    console.log(`Found ${allJobs.length} total jobs`);

    let newJobsCount = 0;
    for (const job of allJobs) {
      if (!job.id || !isNew(job.id)) continue;
      if (!job.title || !job.company) continue;

      newJobsCount++;
      console.log(`[Job] Found: "${job.title}" @ "${job.company}" (${job.source})`);

      // Classify the offer before notifying or saving its analysis.
      const analysis = await analyzeJob(job);
      const message = formatJobNotification(job, analysis);
      // Send Telegram notification only for relevant offers (score >= 4) to avoid notification spam
      const isRelevant = analysis ? analysis.match_score >= 4 : true;
      if (isRelevant) {
        try {
          await sendMessage(message);
          console.log(`[Telegram] Sent notification for: ${job.title} (Score: ${analysis?.match_score || 'N/A'}/10)`);
        } catch (tgErr) {
          console.error('[Telegram] Failed to send message:', tgErr.message);
        }
      } else {
        console.log(`[Telegram] 🔕 Notification ignorée (non pertinent, score: ${analysis?.match_score}/10) : "${job.title}"`);
      }

      // Append offer to Excel
      try {
        appendToExcel(job, analysis || {});
      } catch (excelErr) {
        console.error('[Excel] Error:', excelErr.message);
      }

      markSeen(job, analysis);
      await new Promise(r => setTimeout(r, 2000));
    }

    console.log(`Scraping done. ${newJobsCount} new jobs processed.`);
    if (options.chatId) {
      const summaryMsg = newJobsCount > 0
        ? `✅ *Recherche terminée avec succès !*\n🎯 *${newJobsCount}* nouvelle(s) offre(s) trouvée(s) et envoyée(s).`
        : `✅ *Recherche terminée.*\nAucune nouvelle offre trouvée pour le moment.`;
      await sendMessage(summaryMsg, options.chatId);
    }

  } catch (err) {
    console.error('Scraper error:', JSON.stringify(err.response?.data) || err.message);
    if (options.chatId) {
      await sendMessage(`❌ *Erreur lors du scraping :* ${err.message}`, options.chatId);
    }
  } finally {
    isScrapingRunning = false;
  }
}

async function reviewHistory(chatId) {
  if (isScrapingRunning || isHistoryRunning) {
    await sendMessage('A search or history review is already running. Retry /history after it finishes.', chatId);
    return;
  }

  const unique = new Map();
  const addJob = job => {
    const key = String(job.url || job.id || '').trim().replace(/\/$/, '').toLowerCase();
    if (!key) return;
    const previous = unique.get(key) || {};
    unique.set(key, { ...previous, ...job, description: job.description || previous.description || '' });
  };
  getDatabaseJobs().forEach(addJob);
  getExcelHistoryJobs().forEach(addJob);
  const jobs = Array.from(unique.values()).filter(job => job.title && job.company);
  if (jobs.length === 0) {
    await sendMessage('No saved offers were found in Excel or the database.', chatId);
    return;
  }

  isHistoryRunning = true;
  const goodJobs = [];
  let reviewed = 0;
  let fetched = 0;
  try {
    await sendMessage(`Re-evaluating all ${jobs.length} unique saved offers. Fetching job pages first; this may take a while.`, chatId);
    await fetchJobDescriptions(jobs, async (done, total, succeeded) => {
      fetched = succeeded;
      if (done % 20 === 0 || done === total) {
        await sendMessage(`Job pages fetched: ${done}/${total}. Now re-scoring all saved offers...`, chatId);
      }
    });

    for (const job of jobs) {
      const analysis = await analyzeJob(job);
      reviewed++;
      if (analysis && analysis.match_score >= 7) goodJobs.push({ job, analysis });
      if (reviewed % 10 === 0 || reviewed === jobs.length) {
        await sendMessage(`AI re-scoring progress: ${reviewed}/${jobs.length}. Good matches so far: ${goodJobs.length}.`, chatId);
      }
      if (reviewed < jobs.length) await new Promise(resolve => setTimeout(resolve, 700));
    }

    if (!goodJobs.length) {
      await sendMessage(`Re-evaluation complete: no offers scored 7/10 or higher among ${reviewed} reviewed. Retrieved ${fetched} job pages.`, chatId);
      return;
    }

    const entries = goodJobs.map(({ job, analysis }) => {
      const reason = String(analysis.match_reason || '').slice(0, 220);
      return `*${job.title}* - ${job.company} | ${analysis.match_score}/10\n${job.location || 'Location not listed'} | ${job.source || 'Saved offer'}\n${reason}\n${job.url || ''}`;
    });
    let message = `Good matches after re-evaluating all saved offers (${goodJobs.length}/${reviewed}, score >= 7/10). Retrieved ${fetched} job pages.\n\n`;
    for (const entry of entries) {
      if (message.length + entry.length > 3500) {
        await sendMessage(message, chatId);
        message = '';
      }
      message += entry + '\n\n';
    }
    if (message.trim()) await sendMessage(message, chatId);
    await sendMessage('Re-evaluation complete. Offers whose pages could not be opened were scored from the saved Excel/database details.', chatId);
  } catch (err) {
    console.error('[History] Re-evaluation failed:', err.message);
    await sendMessage(`History re-evaluation stopped after ${reviewed}/${jobs.length}: ${err.message}`, chatId);
  } finally {
    isHistoryRunning = false;
  }
}
// Default schedule: 08:00 and 20:00 Casablanca
setSchedule('0 8,20 * * *', 'Tous les jours à 08:00 et 20:00 (Casablanca)');

// HTTP Webhook server for external triggers & shutdown
const server = http.createServer(async (req, res) => {
  if (req.url === '/run' && req.method === 'POST') {
    res.writeHead(200);
    res.end('Scraper triggered');
    runScraper();
  } else if ((req.url === '/shutdown' || req.url === '/api/shutdown') && req.method === 'POST') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, message: 'Scraper & Bot (index.js) arrêté avec succès.' }));
    console.log('\n[Index] Arrêt demandé via Webhook. Fermeture du bot et du scraper...');
    setTimeout(() => {
      removePidFile();
      server.close(() => {
        console.log('[Index] Serveur Webhook fermé proprement.');
        process.exit(0);
      });
      setTimeout(() => process.exit(0), 1000);
    }, 300);
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});


server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.warn('[Webhook] Port 3001 déjà utilisé. Le serveur Webhook HTTP est ignoré, mais le bot Telegram et le planificateur fonctionnent normalement.');
  } else {
    console.error('[Webhook] Server error:', err.message);
  }
});

server.listen(3001, () => {
  console.log('Webhook listening on http://localhost:3001/run');
});

// Start Telegram interactive polling listener
startPolling({
  onStart: async (chatId) => {
    const welcomeText = `👋 *Bienvenue sur Tech_IT - Job Hunter Bot !*

Le bot est bien connecté et surveille les offres d'emploi IT & Réseaux au Maroc.

📌 *Commandes disponibles :*
• \`/run\` : Lancer une recherche immédiate
• \`/schedule HH:MM\` : Définir l'heure de scraping (ex: \`/schedule 08:00\` ou \`/start 08:00\`)
• \`/status\` : Voir l'état du bot et les statistiques
- /history : Re-score all saved offers using their job links.
• \`/keywords\` : Voir les postes surveillés
• \`/help\` : Afficher cette aide`;
    await sendMessage(welcomeText, chatId);
  },

  onSchedule: async (chatId, timeStr) => {
    const timeMatch = timeStr.trim().match(/^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/);
    if (!timeMatch) {
      await sendMessage(
        `⚠️ *Format d'heure invalide.*
Veuillez utiliser le format *HH:MM* en 24h.
Exemple : \`/schedule 08:00\` ou \`/start 08:00\``,
        chatId
      );
      return;
    }

    const hour = parseInt(timeMatch[1], 10);
    const minute = parseInt(timeMatch[2], 10);
    const formattedTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    const cronExpr = `${minute} ${hour} * * *`;
    const desc = `Tous les jours à ${formattedTime} (Casablanca)`;

    setSchedule(cronExpr, desc);

    await sendMessage(
      `✅ *Horaire programmé avec succès !*
⏰ Le bot s'exécutera automatiquement *tous les jours à ${formattedTime}* (heure locale de Casablanca).

Vous pouvez aussi lancer une recherche manuelle à tout moment avec la commande \`/run\`.`,
      chatId
    );
  },

  onRun: async (chatId) => {
    if (isScrapingRunning) {
      await sendMessage('⏳ Une recherche d\'offres est déjà en cours. Merci de patienter...', chatId);
      return;
    }
    await sendMessage('🚀 *Lancement immédiat du scraping...*\nRecherche en cours sur LinkedIn, Rekrute, Indeed, Alkhdma et EmploiPublic. Les nouvelles offres s\'afficheront ici.', chatId);
    runScraper({ chatId });
  },

  onHistory: async (chatId, limit) => {
    await reviewHistory(chatId, limit);
  },
  onStatus: async (chatId) => {
    const nowCasablanca = new Date().toLocaleString('fr-FR', { timeZone: 'Africa/Casablanca' });
    const stats = getStats();
    const statusMsg = `📊 *État du système Tech_IT :*
• *Statut :* 🟢 Actif & En écoute
• *Heure (Casablanca) :* ${nowCasablanca}
• *Planning programmé :* ${currentScheduleText}
• *État du scraping :* ${isScrapingRunning ? '🔄 En cours d\'exécution' : '💤 En attente'}
• *Offres enregistrées en base :* ${stats.totalJobs}`;
    await sendMessage(statusMsg, chatId);
  },

  onKeywords: async (chatId) => {
    const list = config.keywords.map(k => `• ${k}`).join('\n');
    await sendMessage(`🔍 *Mots-clés surveillés :*\n${list}`, chatId);
  },

  onHelp: async (chatId) => {
    const helpMsg = `📖 *Aide des commandes Tech_IT Bot :*
• \`/run\` : Déclenche immédiatement une recherche d'offres
• \`/schedule HH:MM\` : Modifie l'heure quotidienne de scraping (ex: \`/schedule 08:00\`)
• \`/start HH:MM\` : Raccourci pour programmer une heure (ex: \`/start 08:00\`)
• \`/status\` : Affiche les informations en temps réel du bot
- /history : Re-score all saved offers using their job links.
• \`/keywords\` : Liste des intitulés de postes recherchés`;
    await sendMessage(helpMsg, chatId);
  },

  onUnknown: async (chatId, text) => {
    await sendMessage(`❓ Commande non reconnue : "${text}"\nTapez \`/help\` pour afficher les commandes disponibles.`, chatId);
  }
});

// Run initial scraper at startup
runScraper();