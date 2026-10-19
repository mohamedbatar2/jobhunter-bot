/**
 * JOBHUNTER AI — Frontend Application Logic
 * Single Page Application router, State management, APIs, and Visualizations
 */

// Global State
const state = {
  currentView: 'dashboard',
  stats: null,
  jobs: [],
  totalJobs: 0,
  jobsPage: 0,
  jobsLimit: 30,
  jobsViewMode: 'cards', // 'cards' | 'table'
  filters: {
    search: '',
    scoreTier: 'all',
    source: 'all',
    cvRecommended: 'all',
    remote: 'all',
    sortBy: 'score_desc'
  },
  currentJobDetail: null,
  applications: [],
  atsViewMode: 'kanban', // 'kanban' | 'table'
  atsSearch: '',
  kpis: null,
  charts: {}
};

// DOM Elements
const views = {
  dashboard: document.getElementById('view-dashboard'),
  jobs: document.getElementById('view-jobs'),
  'job-detail': document.getElementById('view-job-detail'),
  applications: document.getElementById('view-applications'),
  kpis: document.getElementById('view-kpis')
};

const navTabs = {
  dashboard: document.getElementById('tab-dashboard'),
  jobs: document.getElementById('tab-jobs'),
  applications: document.getElementById('tab-applications'),
  kpis: document.getElementById('tab-kpis')
};

// ==========================================================================
// INITIALIZATION & ROUTING
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
  setupNavigation();
  setupFilterListeners();
  setupActionButtons();
  handleHashChange();
  window.addEventListener('hashchange', handleHashChange);

  // Initial data load
  loadDashboardData();
  loadStats();
});

function handleHashChange() {
  const hash = window.location.hash.slice(1);
  if (!hash) {
    switchView('dashboard');
    return;
  }

  const parts = hash.split('/');
  if (parts[0] === 'job' && parts[1]) {
    loadJobDetail(parts[1]);
  } else if (views[parts[0]]) {
    switchView(parts[0]);
  } else {
    switchView('dashboard');
  }
}

function setupNavigation() {
  Object.keys(navTabs).forEach(key => {
    const btn = navTabs[key];
    if (btn) {
      btn.addEventListener('click', () => {
        window.location.hash = key;
      });
    }
  });

  // View toggles
  document.getElementById('btn-view-cards').addEventListener('click', () => {
    state.jobsViewMode = 'cards';
    document.getElementById('btn-view-cards').classList.add('active');
    document.getElementById('btn-view-table').classList.remove('active');
    renderJobs();
  });

  document.getElementById('btn-view-table').addEventListener('click', () => {
    state.jobsViewMode = 'table';
    document.getElementById('btn-view-table').classList.add('active');
    document.getElementById('btn-view-cards').classList.remove('active');
    renderJobs();
  });

  document.getElementById('btn-ats-kanban').addEventListener('click', () => {
    state.atsViewMode = 'kanban';
    document.getElementById('btn-ats-kanban').classList.add('active');
    document.getElementById('btn-ats-table').classList.remove('active');
    document.getElementById('kanban-wrapper').style.display = 'grid';
    document.getElementById('ats-table-wrapper').style.display = 'none';
  });

  document.getElementById('btn-ats-table').addEventListener('click', () => {
    state.atsViewMode = 'table';
    document.getElementById('btn-ats-table').classList.add('active');
    document.getElementById('btn-ats-kanban').classList.remove('active');
    document.getElementById('kanban-wrapper').style.display = 'none';
    document.getElementById('ats-table-wrapper').style.display = 'block';
  });
}

function switchView(viewName, filterParams = null) {
  state.currentView = viewName;

  // Update tabs visual state
  Object.keys(navTabs).forEach(k => {
    if (navTabs[k]) {
      navTabs[k].classList.toggle('active', k === viewName);
    }
  });

  // Update section visibility
  Object.keys(views).forEach(k => {
    if (views[k]) {
      views[k].classList.toggle('active', k === viewName);
    }
  });

  // Load specific view data
  if (viewName === 'dashboard') {
    loadDashboardData();
  } else if (viewName === 'jobs') {
    if (filterParams) {
      if (filterParams.scoreTier) {
        document.getElementById('filter-score-tier').value = filterParams.scoreTier;
        state.filters.scoreTier = filterParams.scoreTier;
      }
    }
    loadJobs();
  } else if (viewName === 'applications') {
    loadApplications();
  } else if (viewName === 'kpis') {
    loadKpis();
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ==========================================================================
// API CLIENT CALLS
// ==========================================================================

async function fetchApi(endpoint, options = {}) {
  try {
    const res = await fetch(endpoint, options);
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Erreur serveur: ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    console.error(`API Error on ${endpoint}:`, err);
    showToast(err.message || 'Une erreur est survenue', 'error');
    throw err;
  }
}

// ==========================================================================
// DASHBOARD OVERVIEW
// ==========================================================================

async function loadStats() {
  try {
    const data = await fetchApi('/api/stats');
    if (data.success && data.stats) {
      state.stats = data.stats;
      document.getElementById('badge-total-jobs').textContent = data.stats.totalJobs || 0;
      document.getElementById('badge-total-apps').textContent = data.stats.totalApps || 0;
      
      document.getElementById('dash-total-jobs').textContent = data.stats.totalJobs || 0;
      document.getElementById('dash-high-match').textContent = data.stats.highMatch || 0;
      document.getElementById('dash-active-apps').textContent = data.stats.activeApps || 0;
      document.getElementById('dash-interviews').textContent = data.stats.interviews || 0;
    }
  } catch (_) {}
}

async function loadDashboardData() {
  loadStats();
  
  // Load top high match opportunities
  try {
    const jobsData = await fetchApi('/api/jobs?limit=5&scoreTier=high&sortBy=score_desc');
    if (jobsData.success && jobsData.jobs) {
      renderDashboardOpportunities(jobsData.jobs);
    }
  } catch (_) {}

  // Load KPI overview for response rate & summary
  try {
    const kpisData = await fetchApi('/api/kpis');
    if (kpisData.success && kpisData.kpis) {
      const ov = kpisData.kpis.overview;
      document.getElementById('dash-response-rate').textContent = (ov.responseRate || 0) + '%';
      renderDashboardPipeline(ov);
      renderDashboardSkillsCloud(kpisData.kpis.topSkills);
    }
  } catch (_) {}
}

function renderDashboardOpportunities(jobs) {
  const container = document.getElementById('dash-high-match-list');
  if (!container) return;

  if (!jobs || !jobs.length) {
    container.innerHTML = `<div class="loader-skeleton">Aucune offre avec score ≥ 7 trouvée. Lancez un scraping pour actualiser.</div>`;
    return;
  }

  container.innerHTML = jobs.map(job => {
    const scoreClass = job.score >= 7 ? 'high' : (job.score >= 4 ? 'mid' : 'low');
    const sourceClass = (job.source || '').toLowerCase();
    const cvTag = job.cv_recommended || 'cv_general';

    return `
      <div class="opp-card">
        <div class="opp-left">
          <div class="score-badge-circle ${scoreClass}">
            <span>${job.score || 0}</span>
            <span class="score-unit">/10</span>
          </div>
          <div class="opp-info">
            <h4 onclick="navigateToJob('${job.id}')" style="cursor:pointer;">${escapeHtml(job.title)}</h4>
            <div class="opp-meta">
              <span class="company-name"><strong>${escapeHtml(job.company)}</strong></span>
              <span>•</span>
              <span class="location-name">${escapeHtml(job.location || 'Maroc')}</span>
              <span class="source-tag ${sourceClass}">${escapeHtml(job.source)}</span>
              <span class="cv-pill">${escapeHtml(cvTag)}</span>
            </div>
          </div>
        </div>
        <div class="opp-actions">
          <button class="btn btn-secondary btn-sm" onclick="navigateToJob('${job.id}')">
            Détails
          </button>
          <a href="${escapeHtml(job.url || '#')}" target="_blank" rel="noopener noreferrer" class="btn btn-emerald btn-sm" onclick="promptApplyAfterClick('${job.id}')">
            Postuler ↗
          </a>
        </div>
      </div>
    `;
  }).join('');
}

function renderDashboardPipeline(ov) {
  const container = document.getElementById('dash-pipeline-summary');
  if (!container) return;

  const items = [
    { label: 'À postuler', count: ov.toApply || 0, color: '#6366f1' },
    { label: 'Candidatures envoyées', count: ov.applied || 0, color: '#38bdf8' },
    { label: 'Entretiens programmés', count: ov.interviews || 0, color: '#f59e0b' },
    { label: 'Offres reçues', count: ov.offers || 0, color: '#10b981' },
    { label: 'Refus / Archivé', count: ov.rejected || 0, color: '#f43f5e' }
  ];

  container.innerHTML = items.map(item => `
    <div class="pipeline-row">
      <div class="pipeline-row-left">
        <span class="pipeline-dot" style="background: ${item.color}; box-shadow: 0 0 8px ${item.color};"></span>
        <span>${item.label}</span>
      </div>
      <span class="pipeline-count" style="color: ${item.color};">${item.count}</span>
    </div>
  `).join('');
}

function renderDashboardSkillsCloud(skills) {
  const container = document.getElementById('dash-skills-cloud');
  if (!container) return;

  if (!skills || !skills.length) {
    container.innerHTML = `<span class="text-dim">Aucune compétence indexée.</span>`;
    return;
  }

  container.innerHTML = skills.slice(0, 12).map(s => `
    <span class="skill-tag" onclick="filterJobsBySkill('${escapeHtml(s.skill)}')">
      <span>${escapeHtml(s.skill)}</span>
      <span class="skill-tag-count">${s.count}</span>
    </span>
  `).join('');
}

function filterJobsBySkill(skill) {
  document.getElementById('filter-search').value = skill;
  state.filters.search = skill;
  switchView('jobs');
}

// ==========================================================================
// VIEW 2: SCRAPED JOBS LIST
// ==========================================================================

function setupFilterListeners() {
  const searchInput = document.getElementById('filter-search');
  const clearBtn = document.getElementById('btn-clear-search');

  let debounceTimer;
  searchInput.addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    clearBtn.style.display = e.target.value ? 'block' : 'none';
    debounceTimer = setTimeout(() => {
      state.filters.search = e.target.value;
      state.jobsPage = 0;
      loadJobs();
    }, 300);
  });

  clearBtn.addEventListener('click', () => {
    searchInput.value = '';
    clearBtn.style.display = 'none';
    state.filters.search = '';
    state.jobsPage = 0;
    loadJobs();
  });

  document.getElementById('filter-score-tier').addEventListener('change', (e) => {
    state.filters.scoreTier = e.target.value;
    state.jobsPage = 0;
    loadJobs();
  });

  document.getElementById('filter-source').addEventListener('change', (e) => {
    state.filters.source = e.target.value;
    state.jobsPage = 0;
    loadJobs();
  });

  document.getElementById('filter-cv').addEventListener('change', (e) => {
    state.filters.cvRecommended = e.target.value;
    state.jobsPage = 0;
    loadJobs();
  });

  document.getElementById('filter-remote').addEventListener('change', (e) => {
    state.filters.remote = e.target.value;
    state.jobsPage = 0;
    loadJobs();
  });

  document.getElementById('filter-sort').addEventListener('change', (e) => {
    state.filters.sortBy = e.target.value;
    state.jobsPage = 0;
    loadJobs();
  });

  // Pagination buttons
  document.getElementById('btn-prev-page').addEventListener('click', () => {
    if (state.jobsPage > 0) {
      state.jobsPage--;
      loadJobs();
    }
  });

  document.getElementById('btn-next-page').addEventListener('click', () => {
    const maxPage = Math.ceil(state.totalJobs / state.jobsLimit) - 1;
    if (state.jobsPage < maxPage) {
      state.jobsPage++;
      loadJobs();
    }
  });

  // ATS Search listener
  const atsSearch = document.getElementById('ats-search-input');
  let atsDebounce;
  atsSearch.addEventListener('input', (e) => {
    clearTimeout(atsDebounce);
    atsDebounce = setTimeout(() => {
      state.atsSearch = e.target.value;
      renderApplications();
    }, 250);
  });
}

async function loadJobs() {
  const container = document.getElementById('jobs-container');
  container.innerHTML = `<div class="loader-skeleton" style="grid-column: 1 / -1;">Recherche et chargement des offres en cours...</div>`;

  const queryParams = new URLSearchParams({
    limit: state.jobsLimit,
    offset: state.jobsPage * state.jobsLimit,
    scoreTier: state.filters.scoreTier,
    source: state.filters.source,
    cvRecommended: state.filters.cvRecommended,
    remote: state.filters.remote,
    search: state.filters.search,
    sortBy: state.filters.sortBy
  });

  try {
    const data = await fetchApi(`/api/jobs?${queryParams.toString()}`);
    if (data.success) {
      state.jobs = data.jobs || [];
      state.totalJobs = data.total || 0;
      updateJobsPagination();
      renderJobs();
    }
  } catch (err) {
    container.innerHTML = `<div class="loader-skeleton" style="grid-column: 1 / -1; color: var(--accent-rose);">Erreur lors du chargement des offres: ${escapeHtml(err.message)}</div>`;
  }
}

function updateJobsPagination() {
  const countLabel = document.getElementById('jobs-count-label');
  const paginationInfo = document.getElementById('pagination-info');
  const btnPrev = document.getElementById('btn-prev-page');
  const btnNext = document.getElementById('btn-next-page');

  countLabel.textContent = `${state.totalJobs} offre(s) trouvée(s)`;

  const totalPages = Math.max(1, Math.ceil(state.totalJobs / state.jobsLimit));
  const currentPage = state.jobsPage + 1;
  paginationInfo.textContent = `Page ${currentPage} sur ${totalPages} (${state.totalJobs} offres)`;

  btnPrev.disabled = state.jobsPage === 0;
  btnNext.disabled = currentPage >= totalPages;
}

function renderJobs() {
  const container = document.getElementById('jobs-container');
  if (!container) return;

  if (!state.jobs.length) {
    container.innerHTML = `
      <div class="loader-skeleton" style="grid-column: 1 / -1;">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom:0.75rem; opacity:0.5;">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <p>Aucune offre ne correspond à vos filtres de recherche.</p>
      </div>
    `;
    return;
  }

  if (state.jobsViewMode === 'cards') {
    container.className = 'jobs-grid-container';
    container.innerHTML = state.jobs.map(job => renderJobCardHtml(job)).join('');
  } else {
    container.className = 'glass-panel';
    container.innerHTML = `
      <div style="overflow-x: auto;">
        <table class="jobs-table">
          <thead>
            <tr>
              <th>Score Match</th>
              <th>Poste & Entreprise</th>
              <th>Localisation</th>
              <th>Source</th>
              <th>CV Recommandé</th>
              <th>Contrat</th>
              <th>Statut</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${state.jobs.map(job => renderJobTableRowHtml(job)).join('')}
          </tbody>
        </table>
      </div>
    `;
  }
}

function renderJobCardHtml(job) {
  const matchClass = job.score >= 7 ? 'high-match' : (job.score >= 4 ? 'mid-match' : 'low-match');
  const circleClass = job.score >= 7 ? 'high' : (job.score >= 4 ? 'mid' : 'low');
  const sourceClass = (job.source || '').toLowerCase();
  const cvTag = job.cv_recommended || 'cv_general';
  const isRemote = job.remote && (job.remote.toLowerCase() === 'oui' || job.remote.toLowerCase() === 'yes');

  const skills = (job.required_skills || '').split(/[,;\n|]+/).map(s => s.trim()).filter(Boolean).slice(0, 4);

  return `
    <div class="job-card ${matchClass}">
      <div>
        <div class="card-top">
          <div style="flex: 1;">
            <h3 class="job-title-link" onclick="navigateToJob('${job.id}')">${escapeHtml(job.title)}</h3>
            <div class="card-company">${escapeHtml(job.company)}</div>
          </div>
          <div class="score-badge-circle ${circleClass}" title="Score d'adéquation IA: ${job.score}/10">
            <span>${job.score || 0}</span>
            <span class="score-unit">/10</span>
          </div>
        </div>

        <div class="card-tags-row">
          <span class="source-tag ${sourceClass}">${escapeHtml(job.source)}</span>
          <span class="cv-pill">${escapeHtml(cvTag)}</span>
          ${isRemote ? `<span class="meta-pill remote-yes">🌐 Remote</span>` : ''}
          <span class="meta-pill">📍 ${escapeHtml(job.location || 'Maroc')}</span>
          ${job.contract_type ? `<span class="meta-pill">📄 ${escapeHtml(job.contract_type)}</span>` : ''}
        </div>

        ${skills.length ? `
          <div class="skills-preview-list">
            ${skills.map(s => `<span class="chip-mini">${escapeHtml(s)}</span>`).join('')}
          </div>
        ` : ''}
      </div>

      <div class="card-footer">
        <div>
          ${job.application_status ? `
            <span class="applied-status-badge" style="background: rgba(99, 102, 241, 0.2); color: #a5b4fc; border: 1px solid rgba(99, 102, 241, 0.4);">
              ✓ ${escapeHtml(job.application_status)}
            </span>
          ` : `
            <span style="font-size: 0.75rem; color: var(--text-dim);">Non postulé</span>
          `}
        </div>

        <div style="display: flex; gap: 0.5rem;">
          <button class="btn btn-secondary btn-sm" onclick="navigateToJob('${job.id}')">
            Détail
          </button>
          <a href="${escapeHtml(job.url || '#')}" target="_blank" rel="noopener noreferrer" class="btn btn-emerald btn-sm" onclick="promptApplyAfterClick('${job.id}')">
            Postuler ↗
          </a>
        </div>
      </div>
    </div>
  `;
}

function renderJobTableRowHtml(job) {
  const circleClass = job.score >= 7 ? 'high' : (job.score >= 4 ? 'mid' : 'low');
  const sourceClass = (job.source || '').toLowerCase();

  return `
    <tr>
      <td>
        <div class="score-badge-circle ${circleClass}" style="width:36px; height:36px; font-size:0.9rem;">
          ${job.score || 0}
        </div>
      </td>
      <td>
        <strong class="job-title-link" onclick="navigateToJob('${job.id}')">${escapeHtml(job.title)}</strong>
        <div style="font-size:0.8rem; color:var(--text-muted);">${escapeHtml(job.company)}</div>
      </td>
      <td>${escapeHtml(job.location || 'Maroc')}</td>
      <td><span class="source-tag ${sourceClass}">${escapeHtml(job.source)}</span></td>
      <td><span class="cv-pill">${escapeHtml(job.cv_recommended || 'cv_general')}</span></td>
      <td>${escapeHtml(job.contract_type || 'Non précisé')}</td>
      <td>
        ${job.application_status ? `
          <span class="applied-status-badge" style="background: rgba(99, 102, 241, 0.2); color: #a5b4fc;">
            ${escapeHtml(job.application_status)}
          </span>
        ` : '<span style="color:var(--text-dim); font-size:0.8rem;">-</span>'}
      </td>
      <td>
        <div style="display:flex; gap:0.4rem;">
          <button class="btn btn-secondary btn-sm" onclick="navigateToJob('${job.id}')">Fiche</button>
          <a href="${escapeHtml(job.url || '#')}" target="_blank" rel="noopener noreferrer" class="btn btn-emerald btn-sm" onclick="promptApplyAfterClick('${job.id}')">
            Postuler ↗
          </a>
        </div>
      </td>
    </tr>
  `;
}

function navigateToJob(jobId) {
  window.location.hash = `job/${jobId}`;
}

// ==========================================================================
// VIEW 3: JOB DETAIL VIEW WITH APPLY BUTTON
// ==========================================================================

async function loadJobDetail(jobId) {
  switchView('job-detail');
  const container = document.getElementById('detail-content-area');
  container.innerHTML = `<div class="loader-skeleton">Chargement complet de la fiche de poste...</div>`;

  try {
    const data = await fetchApi(`/api/jobs/${jobId}`);
    if (data.success && data.job) {
      state.currentJobDetail = data.job;
      renderJobDetailView(data.job);
    } else {
      container.innerHTML = `<div class="loader-skeleton" style="color:var(--accent-rose);">Offre introuvable.</div>`;
    }
  } catch (err) {
    container.innerHTML = `<div class="loader-skeleton" style="color:var(--accent-rose);">Erreur: ${escapeHtml(err.message)}</div>`;
  }
}

function renderJobDetailView(job) {
  const container = document.getElementById('detail-content-area');
  const headerActions = document.getElementById('detail-header-actions');

  const circleClass = job.score >= 7 ? 'high' : (job.score >= 4 ? 'mid' : 'low');
  const sourceClass = (job.source || '').toLowerCase();
  const isRemote = job.remote && (job.remote.toLowerCase() === 'oui' || job.remote.toLowerCase() === 'yes');

  // Quick Action Buttons in Top Bar
  headerActions.innerHTML = `
    <button class="btn btn-secondary btn-sm" onclick="openApplicationModalForJob('${job.id}', '${escapeHtml(job.title)}', '${escapeHtml(job.company)}')">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
      <span>${job.application_id ? 'Modifier Statut Suivi' : 'Ajouter au Suivi'}</span>
    </button>
    <a href="${escapeHtml(job.url || '#')}" target="_blank" rel="noopener noreferrer" class="btn btn-emerald btn-sm" onclick="promptApplyAfterClick('${job.id}')">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
      <span>Postuler sur ${escapeHtml(job.source)}</span>
    </a>
  `;

  // Parse strengths, gaps, skills into lists
  const strengthsList = (job.strengths || '').split(/[,;\n•|]+/).map(s => s.trim()).filter(Boolean);
  const gapsList = (job.gaps || '').split(/[,;\n•|]+/).map(s => s.trim()).filter(Boolean);
  const skillsList = (job.required_skills || '').split(/[,;\n•|]+/).map(s => s.trim()).filter(Boolean);

  container.innerHTML = `
    <!-- Top Header Banner -->
    <div class="detail-header-card glass-panel">
      <div class="detail-title-row">
        <div>
          <h1 class="detail-job-title">${escapeHtml(job.title)}</h1>
          <div class="detail-company-line">${escapeHtml(job.company)} • ${escapeHtml(job.location || 'Maroc')}</div>
        </div>
        <div class="score-badge-circle ${circleClass}" style="width: 64px; height: 64px; font-size: 1.5rem;">
          <span>${job.score || 0}</span>
          <span class="score-unit">/10</span>
        </div>
      </div>

      <!-- Detail Meta Strip -->
      <div class="detail-meta-strip">
        <span class="detail-meta-item">
          <span class="source-tag ${sourceClass}">${escapeHtml(job.source)}</span>
        </span>
        <span class="detail-meta-item">
          <strong>Profil CV conseillé :</strong>
          <span class="cv-pill" style="font-size:0.8rem; padding:0.25rem 0.65rem;">${escapeHtml(job.cv_recommended || 'cv_general')}</span>
        </span>
        <span class="detail-meta-item">
          <strong>Type de contrat :</strong> ${escapeHtml(job.contract_type || 'Non précisé')}
        </span>
        <span class="detail-meta-item">
          <strong>Salaire :</strong> ${escapeHtml(job.salary || 'A négocier')}
        </span>
        <span class="detail-meta-item">
          <strong>Mode :</strong> ${isRemote ? '🌐 Télétravail' : '🏢 Sur site / Hybride'}
        </span>
        <span class="detail-meta-item">
          <strong>Date d'indexation :</strong> ${escapeHtml(job.date_scraped || new Date(job.seen_at).toLocaleDateString('fr-FR'))}
        </span>
      </div>

      <!-- MAIN APPLY CALL TO ACTION BANNER -->
      <div class="detail-cta-bar">
        <div class="cta-left">
          <h4>Prêt à postuler à cette opportunité ?</h4>
          <p>Le lien officiel de l'annonce va s'ouvrir dans un nouvel onglet. Vous pourrez ensuite enregistrer la date et vos notes de candidature.</p>
        </div>
        <a href="${escapeHtml(job.url || '#')}" target="_blank" rel="noopener noreferrer" class="btn-apply-big" onclick="promptApplyAfterClick('${job.id}')">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          <span>Postuler sur le site de l'offre</span>
        </a>
      </div>
    </div>

    <!-- Score & Analysis Card -->
    <div class="score-assessment-card glass-panel">
      <div class="score-radial-box">
        <div class="score-huge text-${job.score >= 7 ? 'emerald' : (job.score >= 4 ? 'amber' : 'rose')}">${job.score || 0}</div>
        <div style="font-size: 0.85rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-top: 0.25rem;">Score de Match</div>
        <div style="font-size: 0.75rem; color: var(--text-dim); margin-top: 0.5rem;">Évalué par Groq LLaMA 3.3 70B</div>
      </div>
      <div>
        <h4 class="score-desc-title">Diagnostic d'Adéquation au Profil de Mohammed Batar</h4>
        <div class="match-reason-box">
          ${escapeHtml(job.match_reason || 'Aucune analyse textuelle spécifique fournie.')}
        </div>
        <div style="margin-top: 1rem; display: flex; align-items: center; gap: 0.75rem; font-size: 0.86rem; color: var(--text-muted);">
          <span>💡 <strong>Conseil d'envoi :</strong> Utilisez le modèle <code>${escapeHtml(job.cv_recommended || 'cv_general')}</code> pour valoriser vos expériences chez DATAPROTECT, LEONI et SYPEX.</span>
        </div>
      </div>
    </div>

    <!-- Strengths vs Gaps Comparison Grid -->
    <div class="comparison-grid">
      <!-- Strengths -->
      <div class="comp-box strengths glass-panel">
        <h4 class="comp-title text-emerald">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          <span>Points Forts Détectés pour cette Offre</span>
        </h4>
        <ul class="comp-list">
          ${strengthsList.length ? strengthsList.map(s => `<li>✓ ${escapeHtml(s)}</li>`).join('') : '<li>Bases informatiques générales, support infrastructure L1/L2.</li>'}
        </ul>
      </div>

      <!-- Gaps -->
      <div class="comp-box gaps glass-panel">
        <h4 class="comp-title text-rose">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span>Écarts / Compétences à Compensser</span>
        </h4>
        <ul class="comp-list">
          ${gapsList.length ? gapsList.map(g => `<li>⚠ ${escapeHtml(g)}</li>`).join('') : '<li>Aucun écart bloquant identifié pour ce poste.</li>'}
        </ul>
      </div>
    </div>

    <!-- Required Skills Tag Cloud -->
    ${skillsList.length ? `
      <div class="glass-panel" style="padding: 1.25rem;">
        <h4 style="font-size: 0.95rem; font-weight: 700; color: #fff; margin-bottom: 0.75rem;">Compétences Techniques Mentionnées</h4>
        <div class="tags-cloud">
          ${skillsList.map(s => `<span class="skill-tag">${escapeHtml(s)}</span>`).join('')}
        </div>
      </div>
    ` : ''}

    <!-- Pre-written Tailored Cover Email -->
    <div class="email-box glass-panel">
      <div class="email-header">
        <div>
          <h4 style="font-size: 1.1rem; font-weight: 700; color: #fff;">Email de Candidature Personnalisé</h4>
          <p style="font-size: 0.82rem; color: var(--text-muted);">Généré sur mesure pour ce poste et prêt à être envoyé</p>
        </div>
        <button class="btn btn-secondary btn-sm" onclick="copyEmailDraft()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          <span id="btn-copy-label">Copier l'Email</span>
        </button>
      </div>

      <div style="margin-bottom: 0.75rem;">
        <strong style="font-size: 0.85rem; color: var(--text-muted);">Objet :</strong>
        <span style="font-family: var(--font-mono); font-size: 0.88rem; color: var(--accent-cyan); margin-left: 0.5rem;" id="email-subject-text">
          ${escapeHtml(job.email_subject || `Candidature : ${job.title} - Mohammed Batar`)}
        </span>
      </div>

      <div class="email-content-preview" id="email-body-text">${escapeHtml(job.email_body || `Madame, Monsieur,\n\nVivement intéressé par l'opportunité de ${job.title} chez ${job.company}, je vous adresse ma candidature.\n\nMon profil technique et mes expériences pratiques en cybersécurité, support d'infrastructure chez LEONI et triage SIEM chez DATAPROTECT me permettront d'apporter une contribution immédiate à vos équipes.\n\nRestant à votre entière disposition pour un entretien,\n\nCordialement,\nMohammed Batar\n+212 695-008079 | Casablanca`)}</div>
    </div>
  `;
}

function promptApplyAfterClick(jobId) {
  setTimeout(() => {
    const job = state.currentJobDetail || state.jobs.find(j => j.id === jobId);
    if (job) {
      openApplicationModalForJob(job.id, job.title, job.company);
    }
  }, 1000);
}

function copyEmailDraft() {
  const subject = document.getElementById('email-subject-text')?.innerText || '';
  const body = document.getElementById('email-body-text')?.innerText || '';
  const fullText = `Objet: ${subject}\n\n${body}`;

  navigator.clipboard.writeText(fullText).then(() => {
    showToast('Email de candidature copié dans le presse-papier !', 'success');
    const label = document.getElementById('btn-copy-label');
    if (label) {
      label.textContent = 'Copié !';
      setTimeout(() => label.textContent = "Copier l'Email", 2000);
    }
  }).catch(() => {
    showToast('Erreur lors de la copie', 'error');
  });
}

// ==========================================================================
// VIEW 4: FOLLOW-UP PAGE (ATS MANAGEMENT & STATUS CHANGER)
// ==========================================================================

async function loadApplications() {
  try {
    const data = await fetchApi('/api/applications');
    if (data.success) {
      state.applications = data.applications || [];
      renderApplications();
    }
  } catch (_) {}
}

function renderApplications() {
  const filtered = state.applications.filter(app => {
    if (!state.atsSearch) return true;
    const q = state.atsSearch.toLowerCase();
    return (
      (app.job_title || '').toLowerCase().includes(q) ||
      (app.job_company || '').toLowerCase().includes(q) ||
      (app.notes || '').toLowerCase().includes(q)
    );
  });

  // Render Kanban Dropzones
  renderKanban(filtered);

  // Render Table View
  renderAtsTable(filtered);

  // Render summary counters
  renderAtsSummary(filtered);
}

function renderAtsSummary(apps) {
  const chipsContainer = document.getElementById('ats-summary-chips');
  if (!chipsContainer) return;

  const total = apps.length;
  const interviews = apps.filter(a => (a.status || '').includes('Entretien')).length;
  const offers = apps.filter(a => (a.status || '').includes('Offre')).length;

  chipsContainer.innerHTML = `
    <span class="stat-chip">Total suivies : <strong>${total}</strong></span>
    <span class="stat-chip">En entretien : <strong class="text-amber">${interviews}</strong></span>
    <span class="stat-chip">Offres : <strong class="text-emerald">${offers}</strong></span>
  `;
}

function renderKanban(apps) {
  const zones = {
    'À postuler': document.getElementById('zone-to-apply'),
    'Postulé': document.getElementById('zone-applied'),
    'Entretien': document.getElementById('zone-interview'),
    'Offre': document.getElementById('zone-offer'),
    'Refus': document.getElementById('zone-rejected')
  };

  const counts = {
    'À postuler': document.getElementById('count-col-to-apply'),
    'Postulé': document.getElementById('count-col-applied'),
    'Entretien': document.getElementById('count-col-interview'),
    'Offre': document.getElementById('count-col-offer'),
    'Refus': document.getElementById('count-col-rejected')
  };

  // Clear dropzones
  Object.keys(zones).forEach(k => {
    if (zones[k]) zones[k].innerHTML = '';
  });

  const totals = { 'À postuler': 0, 'Postulé': 0, 'Entretien': 0, 'Offre': 0, 'Refus': 0 };

  apps.forEach(app => {
    let colKey = 'Postulé';
    const status = app.status || 'Postulé';

    if (status === 'À postuler') colKey = 'À postuler';
    else if (status.includes('Entretien')) colKey = 'Entretien';
    else if (status.includes('Offre')) colKey = 'Offre';
    else if (status.includes('Refus') || status.includes('Archivé') || status === 'Sans réponse') colKey = 'Refus';
    else colKey = 'Postulé';

    totals[colKey] = (totals[colKey] || 0) + 1;

    if (zones[colKey]) {
      zones[colKey].innerHTML += renderKanbanCardHtml(app);
    }
  });

  // Update column count badges
  Object.keys(counts).forEach(k => {
    if (counts[k]) counts[k].textContent = totals[k] || 0;
  });

  // Empty placeholders if needed
  Object.keys(zones).forEach(k => {
    if (zones[k] && !totals[k]) {
      zones[k].innerHTML = `<div style="text-align:center; padding:1.5rem 0.5rem; font-size:0.75rem; color:var(--text-dim);">Aucune candidature</div>`;
    }
  });
}

function renderKanbanCardHtml(app) {
  const cvTag = app.cv_version || app.job_cv_recommended || 'cv_thales';
  const score = app.job_score || 0;
  const scoreClass = score >= 7 ? 'text-emerald' : (score >= 4 ? 'text-amber' : 'text-rose');

  const statusColors = {
    'À postuler': '#6366f1',
    'Postulé': '#38bdf8',
    'Entretien': '#f59e0b',
    'Offre': '#10b981',
    'Refus': '#f43f5e'
  };
  const accentColor = statusColors[app.status] || '#38bdf8';

  return `
    <div class="kanban-card" id="card-${app.id}">
      <div class="card-status-accent" style="background: ${accentColor};"></div>
      
      <h5 onclick="openApplicationModal('${app.id}')">${escapeHtml(app.job_title || 'Poste non renseigné')}</h5>
      <div class="kanban-company">${escapeHtml(app.job_company || 'Entreprise')}</div>

      <div class="kanban-meta-row">
        <span class="cv-pill" style="font-size:0.7rem;">${escapeHtml(cvTag)}</span>
        <span style="font-size:0.75rem; font-family:var(--font-mono); font-weight:700;" class="${scoreClass}">
          Match: ${score}/10
        </span>
      </div>

      ${app.next_step ? `
        <div style="font-size:0.75rem; color:#facc15; margin:0.35rem 0;">
          <strong>Étape :</strong> ${escapeHtml(app.next_step)}
        </div>
      ` : ''}

      ${app.interview_date ? `
        <div style="font-size:0.75rem; color:#a5b4fc; margin:0.35rem 0;">
          📅 <strong>RDV :</strong> ${new Date(app.interview_date).toLocaleString('fr-FR', { dateStyle:'short', timeStyle:'short' })}
        </div>
      ` : ''}

      ${app.notes ? `
        <div class="kanban-notes-box">
          ${escapeHtml(app.notes)}
        </div>
      ` : ''}

      <!-- Fast Status Changer Row -->
      <div class="kanban-actions-row">
        <select class="custom-select" style="font-size:0.72rem; padding:0.25rem 0.4rem;" onchange="quickUpdateAppStatus('${app.id}', this.value)">
          <option value="À postuler" ${app.status === 'À postuler' ? 'selected' : ''}>📝 À postuler</option>
          <option value="Postulé" ${app.status === 'Postulé' ? 'selected' : ''}>🚀 Postulé</option>
          <option value="Entretien" ${app.status === 'Entretien' ? 'selected' : ''}>📞 Entretien</option>
          <option value="Offre" ${app.status === 'Offre' ? 'selected' : ''}>🏆 Offre reçue</option>
          <option value="Refus" ${app.status === 'Refus' ? 'selected' : ''}>❌ Refus</option>
          <option value="Sans réponse" ${app.status === 'Sans réponse' ? 'selected' : ''}>⏳ Sans réponse</option>
        </select>

        <div style="display:flex; gap:0.25rem;">
          <button class="btn btn-secondary btn-sm" style="padding:0.25rem 0.45rem; font-size:0.72rem;" onclick="openApplicationModal('${app.id}')" title="Éditer notes & RDV">
            ✏️
          </button>
          <button class="btn btn-secondary btn-sm" style="padding:0.25rem 0.45rem; font-size:0.72rem; color:var(--accent-rose);" onclick="deleteApplicationPrompt('${app.id}')" title="Supprimer">
            🗑
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderAtsTable(apps) {
  const tbody = document.getElementById('ats-table-body');
  if (!tbody) return;

  if (!apps.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:2rem; color:var(--text-dim);">Aucune candidature enregistrée.</td></tr>`;
    return;
  }

  tbody.innerHTML = apps.map(app => `
    <tr>
      <td>
        <strong style="cursor:pointer;" onclick="openApplicationModal('${app.id}')">${escapeHtml(app.job_title || 'Poste')}</strong>
        <div style="font-size:0.8rem; color:var(--text-muted);">${escapeHtml(app.job_company || 'Entreprise')}</div>
      </td>
      <td>${escapeHtml(app.job_source || 'Manuel')}</td>
      <td>
        <span style="font-family:var(--font-mono); font-weight:700;">${app.job_score || 0}/10</span>
      </td>
      <td><span class="cv-pill">${escapeHtml(app.cv_version || 'cv_thales')}</span></td>
      <td>
        <select class="custom-select" style="font-size:0.8rem;" onchange="quickUpdateAppStatus('${app.id}', this.value)">
          <option value="À postuler" ${app.status === 'À postuler' ? 'selected' : ''}>📝 À postuler</option>
          <option value="Postulé" ${app.status === 'Postulé' ? 'selected' : ''}>🚀 Postulé</option>
          <option value="Entretien" ${app.status === 'Entretien' ? 'selected' : ''}>📞 Entretien</option>
          <option value="Offre" ${app.status === 'Offre' ? 'selected' : ''}>🏆 Offre</option>
          <option value="Refus" ${app.status === 'Refus' ? 'selected' : ''}>❌ Refus</option>
          <option value="Sans réponse" ${app.status === 'Sans réponse' ? 'selected' : ''}>⏳ Sans réponse</option>
        </select>
      </td>
      <td>
        <div style="font-size:0.82rem; color:var(--text-muted); max-width:240px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
          ${escapeHtml(app.next_step || app.notes || '-')}
        </div>
      </td>
      <td style="font-size:0.82rem; color:var(--text-dim);">
        ${app.applied_at ? new Date(app.applied_at).toLocaleDateString('fr-FR') : '-'}
      </td>
      <td>
        <div style="display:flex; gap:0.4rem;">
          <button class="btn btn-secondary btn-sm" onclick="openApplicationModal('${app.id}')">Éditer</button>
          <button class="btn btn-secondary btn-sm" style="color:var(--accent-rose);" onclick="deleteApplicationPrompt('${app.id}')">✕</button>
        </div>
      </td>
    </tr>
  `).join('');
}

// 1-Click Status Update API Call
async function quickUpdateAppStatus(appId, newStatus) {
  try {
    const res = await fetchApi(`/api/applications/${appId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });

    if (res.success) {
      showToast(`Statut mis à jour : "${newStatus}"`, 'success');
      loadApplications();
      loadStats();
    }
  } catch (err) {
    showToast(`Erreur lors de la mise à jour: ${err.message}`, 'error');
  }
}

async function deleteApplicationPrompt(appId) {
  if (!confirm('Supprimer cette candidature de votre suivi ?')) return;

  try {
    const res = await fetchApi(`/api/applications/${appId}`, { method: 'DELETE' });
    if (res.success) {
      showToast('Candidature supprimée', 'success');
      loadApplications();
      loadStats();
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ==========================================================================
// APPLICATION MODAL DIALOG
// ==========================================================================

function openApplicationModalForJob(jobId, jobTitle, jobCompany) {
  document.getElementById('modal-app-title').textContent = 'Ajouter au Suivi des Candidatures';
  document.getElementById('app-id').value = '';
  document.getElementById('app-job-id').value = jobId;
  document.getElementById('app-job-title').value = `${jobTitle} (${jobCompany})`;
  document.getElementById('app-status').value = 'Postulé';
  document.getElementById('app-cv-version').value = 'cv_thales';
  document.getElementById('app-next-step').value = 'Relance dans 7 jours';
  document.getElementById('app-interview-date').value = '';
  document.getElementById('app-notes').value = 'Candidature soumise via le portail officiel.';

  document.getElementById('modal-app').style.display = 'flex';
}

function openApplicationModal(appId) {
  const app = state.applications.find(a => a.id === appId);
  if (!app) return;

  document.getElementById('modal-app-title').textContent = 'Modifier la Candidature';
  document.getElementById('app-id').value = app.id;
  document.getElementById('app-job-id').value = app.job_id || '';
  document.getElementById('app-job-title').value = `${app.job_title || 'Poste'} (${app.job_company || 'Entreprise'})`;
  document.getElementById('app-status').value = app.status || 'Postulé';
  document.getElementById('app-cv-version').value = app.cv_version || 'cv_thales';
  document.getElementById('app-next-step').value = app.next_step || '';
  document.getElementById('app-interview-date').value = app.interview_date ? app.interview_date.slice(0, 16) : '';
  document.getElementById('app-notes').value = app.notes || '';

  document.getElementById('modal-app').style.display = 'flex';
}

function closeModal() {
  document.getElementById('modal-app').style.display = 'none';
}

async function handleApplicationSubmit(event) {
  event.preventDefault();

  const appId = document.getElementById('app-id').value;
  const jobId = document.getElementById('app-job-id').value;
  const status = document.getElementById('app-status').value;
  const cvVersion = document.getElementById('app-cv-version').value;
  const nextStep = document.getElementById('app-next-step').value;
  const interviewDate = document.getElementById('app-interview-date').value;
  const notes = document.getElementById('app-notes').value;

  const payload = {
    id: appId || ('app_' + Date.now()),
    job_id: jobId || null,
    status,
    cv_version: cvVersion,
    next_step: nextStep,
    interview_date: interviewDate || null,
    notes
  };

  try {
    const res = await fetchApi('/api/applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.success) {
      showToast('Candidature enregistrée avec succès', 'success');
      closeModal();
      loadApplications();
      loadStats();
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ==========================================================================
// VIEW 5: KPIS ANALYSES & CV OPTIMIZATION
// ==========================================================================

async function loadKpis() {
  try {
    const data = await fetchApi('/api/kpis');
    if (data.success && data.kpis) {
      state.kpis = data.kpis;
      renderKpisPage(data.kpis);
    }
  } catch (_) {}
}

function renderKpisPage(kpis) {
  const ov = kpis.overview;

  // Key Metric Highlights
  document.getElementById('kpi-interview-rate').textContent = (ov.interviewRate || 0) + '%';
  document.getElementById('kpi-offer-rate').textContent = (ov.offerRate || 0) + '%';

  // Find most frequent CV variant
  if (kpis.cvJobDistribution && kpis.cvJobDistribution.length) {
    const topCvObj = [...kpis.cvJobDistribution].sort((a,b) => b.count - a.count)[0];
    document.getElementById('kpi-top-cv').textContent = topCvObj.cv_recommended;
  }

  // Top Gap
  if (kpis.topGaps && kpis.topGaps.length) {
    document.getElementById('kpi-top-gap').textContent = kpis.topGaps[0].gap;
  }

  // Recommendations Grid
  const recContainer = document.getElementById('kpi-recommendations-list');
  if (recContainer && kpis.recommendations) {
    recContainer.innerHTML = kpis.recommendations.map(r => `
      <div class="rec-card">
        <div>
          <div class="rec-top-row">
            <span class="rec-category">${escapeHtml(r.category)}</span>
            <span class="rec-impact-badge">${escapeHtml(r.impact)}</span>
          </div>
          <h5 style="margin-top: 0.5rem;">${escapeHtml(r.title)}</h5>
          <p style="margin-top: 0.4rem;">${escapeHtml(r.description)}</p>
        </div>
        <div class="rec-target-cv">
          <span style="opacity:0.7;">Profil CV cible :</span>
          <span class="cv-pill" style="font-size:0.7rem;">${escapeHtml(r.cv_target)}</span>
        </div>
      </div>
    `).join('');
  }

  // Render Charts
  renderFunnelChart(kpis.funnel);
  renderCvPerformanceChart(kpis.cvJobDistribution);
  renderSkillsDemandChart(kpis.topSkills);
  renderSourceQualityChart(kpis.sourceStats);
}

// Chart.js Implementations
function renderFunnelChart(funnelData) {
  const ctx = document.getElementById('chart-funnel');
  if (!ctx || !funnelData) return;

  if (state.charts.funnel) state.charts.funnel.destroy();

  state.charts.funnel = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: funnelData.map(f => f.step),
      datasets: [{
        label: 'Volume',
        data: funnelData.map(f => f.count),
        backgroundColor: funnelData.map(f => f.color || '#38bdf8'),
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#94a3b8' }
        },
        x: {
          grid: { display: false },
          ticks: { color: '#cbd5e1' }
        }
      }
    }
  });
}

function renderCvPerformanceChart(cvData) {
  const ctx = document.getElementById('chart-cv');
  if (!ctx || !cvData) return;

  if (state.charts.cv) state.charts.cv.destroy();

  state.charts.cv = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: cvData.map(c => c.cv_recommended),
      datasets: [
        {
          label: 'Offres Correspondantes',
          data: cvData.map(c => c.count),
          backgroundColor: 'rgba(139, 92, 246, 0.65)',
          borderRadius: 6
        },
        {
          label: 'Score Moyen (/10)',
          data: cvData.map(c => c.avg_score),
          backgroundColor: 'rgba(16, 185, 129, 0.75)',
          borderRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#cbd5e1' } }
      },
      scales: {
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#94a3b8' }
        },
        x: {
          grid: { display: false },
          ticks: { color: '#cbd5e1' }
        }
      }
    }
  });
}

function renderSkillsDemandChart(skillsData) {
  const ctx = document.getElementById('chart-skills');
  if (!ctx || !skillsData) return;

  if (state.charts.skills) state.charts.skills.destroy();

  const top10 = skillsData.slice(0, 10);

  state.charts.skills = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: top10.map(s => s.skill),
      datasets: [{
        label: 'Fréquence dans les offres',
        data: top10.map(s => s.count),
        backgroundColor: 'rgba(56, 189, 248, 0.7)',
        borderRadius: 4
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#94a3b8' }
        },
        y: {
          grid: { display: false },
          ticks: { color: '#cbd5e1', font: { size: 11 } }
        }
      }
    }
  });
}

function renderSourceQualityChart(sourcesData) {
  const ctx = document.getElementById('chart-sources');
  if (!ctx || !sourcesData) return;

  if (state.charts.sources) state.charts.sources.destroy();

  state.charts.sources = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: sourcesData.map(s => s.source),
      datasets: [
        {
          label: 'Total Offres',
          data: sourcesData.map(s => s.total),
          backgroundColor: 'rgba(99, 102, 241, 0.7)',
          borderRadius: 6
        },
        {
          label: 'Score Élevé (≥7)',
          data: sourcesData.map(s => s.high_match),
          backgroundColor: 'rgba(16, 185, 129, 0.85)',
          borderRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#cbd5e1' } }
      },
      scales: {
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#94a3b8' }
        },
        x: {
          grid: { display: false },
          ticks: { color: '#cbd5e1' }
        }
      }
    }
  });
}

// ==========================================================================
// ACTION BUTTONS (SYNC & TRIGGER SCRAPER)
// ==========================================================================

function setupActionButtons() {
  const btnSync = document.getElementById('btn-sync');
  btnSync.addEventListener('click', async () => {
    btnSync.disabled = true;
    btnSync.innerHTML = `<span>Syncing...</span>`;
    showToast('Synchronisation avec Excel et enrichissement en cours...', 'info');

    try {
      const res = await fetchApi('/api/sync', { method: 'POST' });
      if (res.success) {
        showToast(res.message || 'Synchronisation terminée !', 'success');
        loadStats();
        if (state.currentView === 'dashboard') loadDashboardData();
        if (state.currentView === 'jobs') loadJobs();
        if (state.currentView === 'applications') loadApplications();
        if (state.currentView === 'kpis') loadKpis();
      }
    } catch (_) {}
    finally {
      btnSync.disabled = false;
      btnSync.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-1.19"/></svg>
        <span>Sync</span>
      `;
    }
  });

  const btnTrigger = document.getElementById('btn-trigger-scraper');
  btnTrigger.addEventListener('click', async () => {
    btnTrigger.disabled = true;
    btnTrigger.innerHTML = `<span>Recherche en cours...</span>`;
    showToast('Recherche d\'offres déclenchée (LinkedIn, Rekrute, Indeed, Alkhdma)...', 'info');

    try {
      const res = await fetchApi('/api/scraper/trigger', { method: 'POST' });
      if (res.success) {
        showToast(res.message, 'success');
      }
    } catch (_) {}
    finally {
      setTimeout(() => {
        btnTrigger.disabled = false;
        btnTrigger.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          <span>Lancer Scraping</span>
        `;
      }, 3000);
    }
  });

  const btnNewApp = document.getElementById('btn-new-application');
  if (btnNewApp) {
    btnNewApp.addEventListener('click', () => {
      openApplicationModalForJob('', 'Candidature Spontanée / Externe', 'Nouvelle Entreprise');
    });
  }
}

// ==========================================================================
// TOAST NOTIFICATIONS
// ==========================================================================

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const iconSvg = type === 'success'
    ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`
    : (type === 'error'
      ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`
      : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`
    );

  toast.innerHTML = `
    ${iconSvg}
    <span>${escapeHtml(message)}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Utility HTML escape
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
