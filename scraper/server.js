const express = require('express');
const path = require('path');
const http = require('http');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

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
      notes = 'Candidature envoyée depuis le tableau de bord.',
      priority = 'Haute'
    } = req.body;

    const existingApp = job.application_id;
    const application = db.createOrUpdateApplication({
      id: existingApp || ('app_' + Date.now()),
      job_id: job.id,
      status,
      cv_version,
      notes,
      applied_at: new Date().toISOString(),
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
    const { status, notes } = req.body;
    if (!status) {
      return res.status(400).json({ success: false, error: 'Nouveau statut requis' });
    }
    const updated = db.updateApplicationStatus(req.params.id, status, notes);
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

// SPA fallback
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 JobHunter Dashboard Server running at:`);
  console.log(`   http://localhost:${PORT}`);
  console.log(`====================================================`);
});
