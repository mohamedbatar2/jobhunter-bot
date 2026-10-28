const { chromium } = require('playwright');

const BASE_URL = 'https://www.emploi-public.ma';

/**
 * IT-relevant keywords to filter public sector job titles.
 * emploi-public.ma lists all public administration posts, so we pre-filter
 * client-side to avoid passing irrelevant titles to the LLM.
 */
const IT_KEYWORDS = [
  'informati', 'numéri', 'digital', 'système', 'réseau', 'cybersécurit',
  'cyber', 'sécurit', 'ingénieur', 'data', 'développeur', 'developer',
  'software', 'applicati', 'infrastructure', 'cloud', 'devops',
  'python', '.net', 'java', 'web', 'api', 'erp', 'tic', 'dsi',
  'analyste', 'telecom', 'machine learning', 'siem', 'technicien',
  'intelligence artificielle'
];

/**
 * Returns true if the post title contains at least one IT-relevant keyword.
 * @param {string} title
 */
function isItRelevant(title) {
  if (!title) return false;
  const lower = title.toLowerCase();
  return IT_KEYWORDS.some(kw => lower.includes(kw));
}

/**
 * Extracts job cards from a loaded Playwright page.
 * Card structure: .card-scale wrapping or being an <a> with h3.card-title and .card-text
 * @param {import('playwright').Page} page
 * @param {string} type - 'concours' | 'emploi-sup' | 'experts'
 */
async function extractCards(page, type) {
  return page.$$eval('.card-scale', (cards, type) => {
    return cards.map(card => {
      const anchor = card.tagName === 'A' ? card : card.querySelector('a');
      if (!anchor) return null;

      const href = anchor.getAttribute('href') || '';
      const titleEl = card.querySelector('h3.card-title, .card-title');
      const companyEl = card.querySelector('.card-text');
      const footerEl = card.querySelector('.card-footer');

      const title = titleEl ? titleEl.innerText.trim() : '';
      const company = companyEl ? companyEl.innerText.replace(/\s+/g, ' ').trim() : '';
      const footerText = footerEl ? footerEl.innerText.trim() : '';

      // Extract deadline from footer
      const deadlineMatch = footerText.match(/Limite de d[eé]p[oô]t\s*:?\s*([^\n]+)/i);
      const deadline = deadlineMatch ? deadlineMatch[1].trim() : '';

      // Extract number of posts
      const postesMatch = footerText.match(/(\d+)\s*postes?/i);
      const postes = postesMatch ? postesMatch[1] : '';

      const url = href.startsWith('http') ? href : `https://www.emploi-public.ma${href}`;
      // UUID-based ID from URL path (e.g. /fr/concours/details/xxxxxxxx-...)
      const idMatch = href.match(/\/([a-f0-9-]{36})\/?$/i);
      const id = idMatch ? `emploi_public_${type}_${idMatch[1]}` : '';

      if (!title || !url || !id) return null;

      return { title, company, url, id, deadline, postes, type };
    }).filter(Boolean);
  }, type);
}

/**
 * Scrapes one listing section across multiple pages.
 * @param {import('playwright').Page} page
 * @param {string} listUrl - base listing URL (no ?page param)
 * @param {string} type   - section type label
 * @param {number} maxPages
 */
async function scrapeListingSection(page, listUrl, type, maxPages = 3) {
  const results = [];
  const seenIds = new Set();

  for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
    const url = pageNum === 1 ? listUrl : `${listUrl}?page=${pageNum}`;
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(1500 + Math.random() * 1000);

      const cards = await extractCards(page, type);
      let added = 0;
      for (const card of cards) {
        if (!seenIds.has(card.id)) {
          seenIds.add(card.id);
          results.push(card);
          added++;
        }
      }

      if (added === 0) break; // No new content on this page, stop early

    } catch (err) {
      console.error(`[EmploiPublic] Error scraping ${url}:`, err.message);
      break;
    }
  }

  return results;
}

/**
 * Fetches the detail page for a card and extracts the full description text.
 * @param {import('playwright').Page} page
 * @param {object} card
 */
async function fetchDetailDescription(page, card) {
  try {
    await page.goto(card.url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(1200 + Math.random() * 800);

    const description = await page.evaluate(() => {
      // Try known description containers
      const selectors = [
        '.detail-desc',
        '.annonce-content',
        '.content-offre',
        '.detail-content',
        '.concours-detail',
        'article',
        '.card-body'
      ];
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el && el.innerText.trim().length > 100) return el.innerText.trim();
      }
      // Fallback: main area text (capped at 2500 chars)
      const main = document.querySelector('main') || document.querySelector('.container');
      return main ? main.innerText.trim().slice(0, 2500) : '';
    });

    return description;
  } catch (err) {
    console.error(`[EmploiPublic] Detail page error for ${card.url}:`, err.message);
    return '';
  }
}

/**
 * Main scraper function for emploi-public.ma.
 * Scrapes three sections:
 *  - /fr/concours-liste     (Concours de recrutement)
 *  - /fr/emploi-sup-liste   (Emplois supérieurs)
 *  - /fr/experts-liste      (Recrutement des experts)
 *
 * Only IT-relevant titles pass through the pre-filter.
 * Detail pages are fetched for full description text.
 */
async function scrapeEmploiPublic() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.setExtraHTTPHeaders({
    'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
  });

  const sections = [
    { url: `${BASE_URL}/fr/concours-liste`,   type: 'concours',  pages: 3 },
    { url: `${BASE_URL}/fr/emploi-sup-liste`, type: 'emploi-sup', pages: 2 },
    { url: `${BASE_URL}/fr/experts-liste`,    type: 'experts',    pages: 2 }
  ];

  let allCards = [];

  for (const section of sections) {
    try {
      const cards = await scrapeListingSection(page, section.url, section.type, section.pages);
      const filtered = cards.filter(c => isItRelevant(c.title));
      console.log(`[EmploiPublic] ${section.type}: ${cards.length} total cards, ${filtered.length} IT-relevant`);
      allCards.push(...filtered);
    } catch (err) {
      console.error(`[EmploiPublic] Section ${section.type} failed:`, err.message);
    }
  }

  // Deduplicate across sections by ID
  const seen = new Set();
  allCards = allCards.filter(c => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });

  console.log(`[EmploiPublic] ${allCards.length} unique IT-relevant listings to process`);

  // Fetch detail pages and build final job objects
  const jobs = [];
  for (const card of allCards) {
    const detailText = await fetchDetailDescription(page, card);

    const syntheticDesc = [
      `Poste : ${card.title}`,
      card.company ? `Administration : ${card.company}` : '',
      card.postes   ? `Nombre de postes : ${card.postes}` : '',
      card.deadline ? `Limite de dépôt : ${card.deadline}` : '',
      `Type d'annonce : ${card.type}`,
      'Portail : Emploi Public Maroc (Secteur public)',
      detailText ? `\nDétails :\n${detailText}` : ''
    ].filter(Boolean).join('\n');

    jobs.push({
      id: card.id,
      title: card.title,
      company: card.company || 'Administration publique marocaine',
      location: 'Maroc',
      url: card.url,
      description: syntheticDesc,
      source: 'EmploiPublic'
    });

    await page.waitForTimeout(800 + Math.random() * 800);
  }

  await browser.close();
  console.log(`[EmploiPublic] Done: ${jobs.length} jobs returned`);
  return jobs;
}

module.exports = { scrapeEmploiPublic };
