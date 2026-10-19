/**
 * Preprocessor module for JobHunter Bot
 * Filters out irrelevant jobs and sanitizes job content to save LLM tokens.
 */

// Blacklist of terms that are definitely NOT relevant for Systems / Networks / Support IT profile
const NEGATIVE_TITLE_PATTERNS = [
  // Call center / Customer service
  /\bconseill?er\s+(client|commercial|technique|voyage|bancaire)\b/i,
  /\bt[eé]l[eé](conseill?er|vendeur|op[eé]rateur|acteur|vente|prospection)\b/i,
  /\bcustomer\s+(service|care|support\s+agent|experience|representative|success)\b/i,
  /\bcall\s*center\b/i,
  /\bcentre\s+d['’]appels?\b/i,
  /\bcharg[eé]\s+de\s+(client[eè]le|recouvrement|compte)\b/i,

  // HR / Recruitment
  /\b(recrutement|recruiter|ressources\s+humaines|talent\s+acquisition|charg[eé]\s+rh|hr\s+(specialist|officer|assistant|manager)|gestionnaire\s+paie)\b/i,

  // Sales / Commerce / Marketing
  /\b(commercial|technico-commercial|vendeur|vendeuse|charg[eé]\s+d['’]affaires|business\s+developer|marketing|community\s+manager|growth|chef\s+de\s+produit)\b/i,

  // Accounting / Finance
  /\b(comptable|comptabilit[eé]|expert-comptable|auditeur|contr[oô]leur\s+de\s+gestion|tr[eé]sorier|analyste\s+financier|actuaire)\b/i,

  // Medical / Healthcare / Agriculture
  /\b(m[eé]decin|infirmi[eè]re?|pharmacien?|v[eé]t[eé]rinaire|sant[eé]|biologiste|vaccination|sage-femme)\b/i,

  // Non-IT trades / Logistics
  /\b(juriste|avocat|notaire|cuisinier|serveur|chauffeur|magasinier|cariste|livreur|agent\s+d['’]entretien|agent\s+de\s+s[eé]curit[eé]|enseignant|professeur)\b/i
];

// Keywords indicating IT infrastructure, systems, networks, IT support, hardware, GLPI, etc.
const POSITIVE_IT_KEYWORDS = [
  /\bsyst[eè]mes?\b/i,
  /\br[eé]seaux?\b/i,
  /\bnetwork\b/i,
  /\bsupport\s*(it|informatique|utilisateurs?|technique|niveau\s*[123]|n[123])\b/i,
  /\bhelpdesk\b/i,
  /\btechnicien(\s+informatique|\s+support|\s+r[eé]seau|\s+syst[eè]me|\s+micro|\s+de\s+parc|\s+maintenance)?\b/i,
  /\badministrateur\s+(syst[eè]mes?|r[eé]seaux?|it|infrastructure)\b/i,
  /\binfrastructure\s*(digitale|it|syst[eè]me)?\b/i,
  /\bparc\s+informatique\b/i,
  /\bglpi\b/i,
  /\bactive\s+directory\b/i,
  /\bwindows\s+server\b/i,
  /\blinux\b/i,
  /\bcisco\b/i,
  /\bmaintenance\s+informatique\b/i,
  /\bd[eé]ploiement\s+(it|poste|mat[eé]riel)\b/i,
  /\bdevops\b/i,
  /\bcloud\b/i,
  /\bs[eé]curit[eé]\s+informatique\b/i,
  /\bcybers[eé]curit[eé]\b/i,
  /\bstage\s*(syst[eè]mes?|r[eé]seaux?|it|informatique|helpdesk|support)\b/i
];

/**
 * Pre-filters a job by title to determine if an expensive LLM call is warranted.
 * @param {Object} job
 * @returns {{ shouldAnalyze: boolean, reason?: string }}
 */
function shouldAnalyzeJob(job) {
  const title = (job.title || '').trim();

  if (!title) {
    return { shouldAnalyze: false, reason: 'Titre manquant' };
  }

  // Check 1: Exclude obvious blacklist matches
  for (const pattern of NEGATIVE_TITLE_PATTERNS) {
    if (pattern.test(title)) {
      return {
        shouldAnalyze: false,
        reason: `Exclu par mot-clé négatif (métier hors cible : ${title})`
      };
    }
  }

  // Check 2: Check if title has positive IT signals
  const hasPositiveSignal = POSITIVE_IT_KEYWORDS.some(pattern => pattern.test(title));
  if (hasPositiveSignal) {
    return { shouldAnalyze: true };
  }

  // Check 3: Check if description has strong IT support/system keywords if title is generic
  const desc = (job.description || '');
  if (desc && desc.length > 50) {
    const descMatches = POSITIVE_IT_KEYWORDS.filter(pattern => pattern.test(desc));
    if (descMatches.length >= 2) {
      return { shouldAnalyze: true };
    }
  }

  // If no positive signal found in title or description
  return {
    shouldAnalyze: false,
    reason: `Titre ne correspondant pas au domaine Systèmes / Réseaux / Support IT (${title})`
  };
}

/**
 * Sanitizes and truncates job description to reduce token consumption by 60-80%.
 * @param {string} text
 * @param {number} maxChars - Default 1500 chars (approx 250-300 words)
 * @returns {string}
 */
function sanitizeDescription(text, maxChars = 1500) {
  if (!text || typeof text !== 'string') return 'Non disponible';

  let cleaned = text
    // Strip HTML tags
    .replace(/<[^>]*>/g, ' ')
    // Replace multiple spaces and newlines
    .replace(/[ \t]+/g, ' ')
    .replace(/(\r?\n\s*){2,}/g, '\n')
    // Remove URLs
    .replace(/https?:\/\/\S+/gi, '')
    // Remove boilerplate privacy / cookie policies
    .replace(/cookies?\s+policy|politique\s+de\s+confidentialit[eé]|conditions\s+g[eé]n[eé]rales/gi, '')
    .trim();

  if (cleaned.length > maxChars) {
    // Truncate at word boundary
    const truncated = cleaned.slice(0, maxChars);
    const lastSpace = truncated.lastIndexOf(' ');
    cleaned = (lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated) + '... [suite tronquée pour optimisation]';
  }

  return cleaned || 'Non disponible';
}

/**
 * Creates a synthetic analysis for rejected jobs without spending any LLM tokens.
 * @param {Object} job
 * @param {string} reason
 * @returns {Object}
 */
function createSyntheticRejection(job, reason) {
  return {
    match_score: 1,
    match_reason: `Pré-filtrage : ${reason}`,
    gaps: ['Poste hors du périmètre Systèmes, Réseaux ou Support IT.'],
    remote: false,
    classification: {
      domaine: 'autre',
      niveau: 'non_precise',
      contrat: 'non_precise',
      mode_travail: 'non_precise',
      zone: 'maroc',
      decision: 'non_pertinent'
    },
    cv_recommande: 'cv_general',
    fiche: {
      poste: job.title || 'Non précisé',
      entreprise: job.company || 'Non précisé',
      localisation: job.location || 'Maroc',
      type_contrat: 'Non précisé',
      salaire: 'Non précisé',
      competences_requises: [],
      points_forts: [],
      langue_requise: 'Français'
    },
    draft_email: {
      objet: '',
      corps: ''
    }
  };
}

module.exports = {
  shouldAnalyzeJob,
  sanitizeDescription,
  createSyntheticRejection
};
