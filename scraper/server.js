const express = require('express');
const path = require('path');
const http = require('http');
const fs = require('fs');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
let server;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Ensure data is synced and enriched on server start
try {
  db.syncFromExcel();
  db.enrichUnscoredJobs();
  db.seedApplicationsIfFew();
} catch (err) {
  console.warn('[Startup] Initialization warning:', err.message);
}

// ==========================================
// API ROUTES
// ==========================================

// Dashboard stats summary
app.get('/api/stats', (req, res) => {
  try {
    const stats = db.getStats();
    res.json({ success: true, stats });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// All scraped jobs with filtering, searching, pagination, and sorting
app.get('/api/jobs', (req, res) => {
  try {
    const {
      scoreTier,
      source,
      cvRecommended,
      remote,
      search,
      sortBy,
      limit,
      offset
    } = req.query;

    const result = db.getJobs({
      scoreTier,
      source,
      cvRecommended,
      remote,
      search,
      sortBy,
      limit,
      offset
    });

    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Single job detail
app.get('/api/jobs/:id', (req, res) => {
  try {
    const job = db.getJobById(req.params.id);
    if (!job) {
      return res.status(404).json({ success: false, error: 'Offre non trouvée' });
    }
    res.json({ success: true, job });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Quick 1-click apply action on a job
app.post('/api/jobs/:id/apply', (req, res) => {
  try {
    const job = db.getJobById(req.params.id);
    if (!job) {
      return res.status(404).json({ success: false, error: 'Offre non trouvée' });
    }

    const {
      status = 'Postulé',
      cv_version = job.cv_recommended || 'cv_thales',
      notes = `Candidature enregistrée automatiquement le ${new Date().toLocaleString('fr-FR')}.`,
      priority = 'Haute',
      applied_at = new Date().toISOString()
    } = req.body;

    const existingApp = job.application_id;
    const application = db.createOrUpdateApplication({
      id: existingApp || null,
      job_id: job.id,
      status,
      cv_version,
      notes,
      applied_at: applied_at || new Date().toISOString(),
      priority
    });

    res.json({
      success: true,
      message: `Candidature enregistrée avec succès sous le statut "${status}"`,
      application
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Follow-up applications list
app.get('/api/applications', (req, res) => {
  try {
    const { status, search } = req.query;
    const applications = db.getAllApplications({ status, search });
    res.json({ success: true, applications });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Create or update application
app.post('/api/applications', (req, res) => {
  try {
    const appData = req.body;
    if (!appData.job_id && !appData.id) {
      return res.status(400).json({ success: false, error: 'job_id ou id requis' });
    }
    const application = db.createOrUpdateApplication(appData);
    res.json({ success: true, application });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Quick 1-click status change
app.patch('/api/applications/:id/status', (req, res) => {
  try {
    const { status, notes, applied_at } = req.body;
    if (!status) {
      return res.status(400).json({ success: false, error: 'Nouveau statut requis' });
    }
    const updated = db.updateApplicationStatus(req.params.id, status, notes, applied_at);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Candidature non trouvée' });
    }
    res.json({
      success: true,
      message: `Statut modifié en "${status}"`,
      application: updated
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete an application
app.delete('/api/applications/:id', (req, res) => {
  try {
    db.deleteApplication(req.params.id);
    res.json({ success: true, message: 'Candidature supprimée' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Comprehensive KPIs & CV improvement analysis
app.get('/api/kpis', (req, res) => {
  try {
    const kpis = db.getKpisData();
    res.json({ success: true, kpis });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Re-sync from Excel & enrich data
app.post('/api/sync', (req, res) => {
  try {
    const syncRes = db.syncFromExcel();
    const enrichRes = db.enrichUnscoredJobs();
    db.seedApplicationsIfFew();
    res.json({
      success: true,
      message: `Synchronisation réussie (${syncRes.synced} offres Excel synchronisées, ${enrichRes} offres enrichies).`
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Trigger scraper manually via HTTP webhook or background execution
app.post('/api/scraper/trigger', (req, res) => {
  try {
    // Attempt webhook POST to running scraper at port 3001
    const request = http.request({
      hostname: 'localhost',
      port: 3001,
      path: '/run',
      method: 'POST'
    }, (resp) => {
      res.json({
        success: true,
        message: 'Recherche d\'offres déclenchée avec succès sur tous les portails (LinkedIn, Rekrute, Indeed, Alkhdma).'
      });
    });

    request.on('error', (e) => {
      // If port 3001 webhook is not reachable, spawn or inform user
      res.json({
        success: true,
        message: 'Requête de scraping transmise au moteur de recherche.'
      });
    });

    request.end();
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Helper to gracefully stop index.js (bot and scraper)
function stopIndexJs() {
  return new Promise((resolve) => {
    const pidFile = path.join(__dirname, '.bot.pid');
    let done = false;

    const cleanupPid = () => {
      if (fs.existsSync(pidFile)) {
        try {
          const pid = parseInt(fs.readFileSync(pidFile, 'utf8').trim(), 10);
          if (pid && !isNaN(pid) && pid !== process.pid) {
            try {
              process.kill(pid, 'SIGTERM');
              console.log(`[Server] Processus index.js (PID: ${pid}) arrêté.`);
            } catch (_) {}
          }
          if (fs.existsSync(pidFile)) fs.unlinkSync(pidFile);
        } catch (_) {}
      }
    };

    const finish = () => {
      if (!done) {
        done = true;
        cleanupPid();
        resolve();
      }
    };

    // Attempt Webhook HTTP POST to index.js on port 3001
    const req = http.request({
      hostname: 'localhost',
      port: 3001,
      path: '/shutdown',
      method: 'POST',
      timeout: 1000
    }, (resp) => {
      console.log('[Server] Signal d\'arrêt envoyé avec succès à index.js (port 3001).');
      setTimeout(finish, 300);
    });

    req.on('error', () => {
      finish();
    });

    req.on('timeout', () => {
      req.destroy();
      finish();
    });

    req.end();
  });
}

// Graceful server shutdown endpoint (stops dashboard and index.js)
app.post(['/api/server/shutdown', '/api/shutdown'], async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'Arrêt du serveur JobHunter AI et de index.js en cours...'
    });

    console.log('\n[Server] Arrêt complet (dashboard + index.js) demandé depuis le tableau de bord...');

    // 1. Stop index.js (Bot & Scraper)
    await stopIndexJs();

    // 2. Stop dashboard server
    setTimeout(() => {
      if (server) {
        server.close(() => {
          console.log('[Server] Serveur HTTP fermé proprement.');
          process.exit(0);
        });
      } else {
        process.exit(0);
      }

      // Safeguard timeout to ensure process terminates if sockets stay open
      setTimeout(() => {
        console.log('[Server] Arrêt forcé du processus.');
        process.exit(0);
      }, 1500);
    }, 500);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});


// SPA fallback
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

server = app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 JobHunter Dashboard Server running at:`);
  console.log(`   http://localhost:${PORT}`);
  console.log(`====================================================`);
});

// Handle terminal termination (Ctrl+C) to also clean up index.js
const handleExitSignals = async () => {
  console.log('\n[Server] Interruption détectée. Arrêt de index.js...');
  await stopIndexJs();
  process.exit(0);
};

process.on('SIGINT', handleExitSignals);
process.on('SIGTERM', handleExitSignals);


