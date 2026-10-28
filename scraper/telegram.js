const axios = require('axios');
const config = require('./config');

function formatList(val) {
  if (Array.isArray(val)) return val.filter(Boolean).join(', ');
  if (typeof val === 'string' && val.trim().length > 0) return val.trim();
  return '';
}

function formatContrat(typeContrat, classificationContrat) {
  const map = {
    internship: 'Stage',
    apprenticeship: 'Alternance',
    permanent: 'CDI',
    fixed_term: 'CDD',
    freelance: 'Freelance',
    unknown: 'Non précisé'
  };
  if (typeContrat && typeContrat.toLowerCase() !== 'non_precise' && typeContrat.toLowerCase() !== 'unknown') {
    return typeContrat;
  }
  if (classificationContrat && map[classificationContrat]) {
    return map[classificationContrat];
  }
  return 'Non précisé';
}

function formatJobNotification(job, analysis) {
  if (!analysis) {
    return [
      `💼 ${job.title || 'Poste non précisé'}`,
      `🏢 ${job.company || 'Entreprise non précisée'}`,
      `📄 Non précisé | 💰 Non précisé`,
      `⭐ Match: N/A — Analyse IA indisponible`,
      `✅ Points forts:`,
      `🔧 Requis:`,
      job.url ? `🔗 [Voir l'offre](${job.url})` : '',
      `📡 Source: ${job.source || 'Non précisé'}`
    ].filter(Boolean).join('\n');
  }

  const f = analysis.fiche || {};
  const classification = analysis.classification || {};

  const domainIcons = {
    cybersecurity: '🔐',
    it_operations: '🖥️',
    software_development: '💻',
    grc_finance: '📊',
    other: '💼'
  };
  const icon = domainIcons[classification.domaine] || '🔐';
  const title = job.title || f.poste || 'Poste non précisé';
  const company = job.company || f.entreprise || 'Entreprise non précisée';

  const contrat = formatContrat(f.type_contrat, classification.contrat);
  const salaire = (f.salaire && f.salaire.toLowerCase() !== 'non_precise') ? f.salaire : 'Non précisé';

  const score = analysis.match_score ?? 'N/A';
  const reason = analysis.match_reason || 'Description non disponible, impossible d\'évaluer l\'adéquation';

  const pointsForts = formatList(f.points_forts);
  const requis = formatList(f.competences_requises);

  const trackLabels = {
    cybersecurity: 'Cybersécurité',
    software_development: 'Développement Logiciel',
    it_operations: 'Opérations & Support IT',
    grc_finance: 'GRC & Finance',
    other: 'Autre IT'
  };
  const targetLabels = {
    primary_target: 'Cible principale',
    secondary_target: 'Filière secondaire',
    opportunistic: 'Opportunité'
  };

  const trackKey = analysis.career_track || classification.domaine;
  const trackName = trackLabels[trackKey] || trackKey || 'IT';
  const targetDesc = targetLabels[analysis.target_type] || analysis.target_type || '';
  const trackLine = `🎯 Filière: ${trackName}${targetDesc ? ' (' + targetDesc + ')' : ''}${analysis.cv_recommande ? ' | 📎 ' + analysis.cv_recommande : ''}`;

  const lines = [
    `${icon} ${title}`,
    `🏢 ${company}`,
    trackLine,
    `📄 ${contrat} | 💰 ${salaire}`,
    `⭐ Match: ${score}/10 — ${reason}`,
    `✅ Points forts:${pointsForts ? ' ' + pointsForts : ''}`,
    `🔧 Requis:${requis ? ' ' + requis : ''}`
  ];

  const draftEmail = analysis.draft_email;
  if (draftEmail && (draftEmail.objet || draftEmail.corps)) {
    if (draftEmail.objet) {
      lines.push(`📧 Objet: ${draftEmail.objet.trim()}`);
    }
    if (draftEmail.corps) {
      lines.push(draftEmail.corps.trim());
    }
  }

  if (job.url) {
    lines.push(`🔗 [Voir l'offre](${job.url})`);
  }
  lines.push(`📡 Source: ${job.source || 'Non précisé'}`);

  return lines.join('\n');
}

async function sendMessage(text, targetChatId = null) {
  const chatId = targetChatId || config.telegram.chatId;
  if (!config.telegram.token || !chatId) {
    console.warn('Telegram token or chatId is missing in config.');
    return;
  }

  const url = `https://api.telegram.org/bot${config.telegram.token}/sendMessage`;

  try {
    // Try sending with Markdown formatting
    await axios.post(url, {
      chat_id: chatId,
      text: text,
      parse_mode: 'Markdown',
      disable_web_page_preview: false,
    });
  } catch (err) {
    console.warn('[Telegram] Markdown send failed, falling back to plain text:', err.response?.data?.description || err.message);
    try {
      // Fallback to plain text if Markdown fails due to special characters
      const plainText = text
        .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '$1 : $2')
        .replace(/[*_`]/g, '');
      await axios.post(url, {
        chat_id: chatId,
        text: plainText,
        disable_web_page_preview: false,
      });
      console.log('[Telegram] Message sent successfully via fallback mode.');
    } catch (fallbackErr) {
      console.error('[Telegram] Error sending message via fallback:', fallbackErr.response?.data || fallbackErr.message);
    }
  }
}

let isPolling = false;

function startPolling(handlers = {}) {
  if (isPolling) return;
  if (!config.telegram.token) {
    console.warn('[Telegram] Token missing, polling not started.');
    return;
  }

  isPolling = true;
  let offset = 0;
  console.log('[Telegram] Long-polling listener started...');

  const poll = async () => {
    while (isPolling) {
      try {
        const resp = await axios.get(
          `https://api.telegram.org/bot${config.telegram.token}/getUpdates`,
          {
            params: {
              offset: offset,
              timeout: 20,
              allowed_updates: ['message'],
            },
            timeout: 30000,
          }
        );

        if (resp.data && resp.data.ok && Array.isArray(resp.data.result)) {
          for (const update of resp.data.result) {
            offset = update.update_id + 1;
            const msg = update.message;
            if (!msg || !msg.text) continue;

            const text = msg.text.trim();
            const chatId = msg.chat.id;

            // Optional auth check: if config.telegram.chatId is configured and differs
            if (config.telegram.chatId && String(chatId) !== String(config.telegram.chatId)) {
              console.warn(`[Telegram] Unauthorized message from chat ${chatId}`);
              await sendMessage(
                `⚠️ *Accès non autorisé.* (Chat ID : \`${chatId}\`)\n\nPour autoriser votre compte, mettez à jour votre \`.env\` avec :\n\`TELEGRAM_CHAT_ID=${chatId}\``,
                chatId
              );
              continue;
            }

            console.log(`[Telegram] Received command: "${text}" from ${chatId}`);

            // Parse commands
            const parts = text.split(/\s+/);
            const rawCommand = parts[0].toLowerCase();
            const command = rawCommand.split('@')[0]; // Strip bot username if /start@bot
            const args = parts.slice(1);

            if (command === '/start') {
              if (args.length > 0 && handlers.onSchedule) {
                // e.g. /start 08:00
                await handlers.onSchedule(chatId, args.join(' '));
              } else if (handlers.onStart) {
                await handlers.onStart(chatId);
              }
            } else if (command === '/schedule' || command === '/horaire') {
              if (handlers.onSchedule) {
                await handlers.onSchedule(chatId, args.join(' '));
              }
            } else if (command === '/run' || command === '/scrape') {
              if (handlers.onRun) {
                await handlers.onRun(chatId);
              }
            } else if (command === '/history') {
              if (handlers.onHistory) {
                await handlers.onHistory(chatId, args[0] || '');
              }            } else if (command === '/status') {
              if (handlers.onStatus) {
                await handlers.onStatus(chatId);
              }
            } else if (command === '/keywords' || command === '/motscles') {
              if (handlers.onKeywords) {
                await handlers.onKeywords(chatId);
              }
            } else if (command === '/help') {
              if (handlers.onHelp) {
                await handlers.onHelp(chatId);
              }
            } else {
              if (handlers.onUnknown) {
                await handlers.onUnknown(chatId, text);
              }
            }
          }
        }
      } catch (err) {
        if (err.code !== 'ECONNABORTED' && !err.message?.includes('timeout')) {
          console.error('[Telegram Polling Error]:', err.response?.data || err.message);
        }
        await new Promise(r => setTimeout(r, 2000));
      }
    }
  };

  poll();
}

module.exports = { sendMessage, startPolling, formatJobNotification };
