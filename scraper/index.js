const cron = require('node-cron');
const { scrapeLinkedIn } = require('./scrapers/linkedin');
const { scrapeRekrute } = require('./scrapers/rekrute');
const { scrapeIndeed } = require('./scrapers/indeed');
const { scrapeAlkhdma } = require('./scrapers/alkhdma');
const { analyzeJob } = require('./groq');
const { sendMessage } = require('./telegram');
const { isNew, markSeen } = require('./db');
const http = require('http');
const axios = require('axios');

async function runScraper() {
  console.log(`[${new Date().toISOString()}] Scraping started...`);

  try {
    const linkedinJobs = await scrapeLinkedIn();
    const rekruteJobs = await scrapeRekrute();
    const indeedJobs = await scrapeIndeed();
    const alkhdmaJobs = await scrapeAlkhdma();

    const allJobs = [...linkedinJobs, ...rekruteJobs, ...indeedJobs, ...alkhdmaJobs];
    console.log(`Found ${allJobs.length} total jobs`);

    for (const job of allJobs) {
      if (!job.id || !isNew(job.id)) continue;
      if (!job.title || !job.company) continue;

      const analysis = await analyzeJob(job);
      if (!analysis) continue;

      const score = parseInt(analysis.match_score);

      const message = `
🔐 *${analysis.fiche.poste}*
🏢 ${analysis.fiche.entreprise}
📄 ${analysis.fiche.type_contrat} | 💰 ${analysis.fiche.salaire}
⭐ Match: *${analysis.match_score}/10* — ${analysis.match_reason}

✅ Points forts: ${analysis.fiche.points_forts.join(', ')}
🔧 Requis: ${analysis.fiche.competences_requises.join(', ')}

📧 *Objet:* ${analysis.draft_email.objet}

${analysis.draft_email.corps}

🔗 [Voir l'offre](${job.url})
📡 Source: ${job.source}
`;

      await sendMessage(message);

      if (score >= 7) {
        try {
          await axios.post('http://localhost:5678/webhook/jobs', {
            job: job,
            analysis: analysis,
          });
        } catch (e) {
          console.error('n8n webhook error:', e.message);
        }
      }

      markSeen(job);
      await new Promise(r => setTimeout(r, 2000));
    }

    console.log('Scraping done.');

  } catch (err) {
    console.error('Scraper error:', JSON.stringify(err.response?.data) || err.message);
  }
}

cron.schedule('0 8,20 * * *', runScraper, {
  timezone: 'Africa/Casablanca'
});

const server = http.createServer(async (req, res) => {
  if (req.url === '/run' && req.method === 'POST') {
    res.writeHead(200);
    res.end('Scraper triggered');
    runScraper();
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(3001, () => {
  console.log('Webhook listening on http://localhost:3001/run');
});

runScraper();