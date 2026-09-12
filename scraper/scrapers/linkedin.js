const { chromium } = require('playwright');
const config = require('../config');

async function scrapeLinkedIn() {
  const jobs = [];
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.setExtraHTTPHeaders({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  });

  for (const keyword of config.keywords.slice(0, 4)) {
    try {
      const url = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(keyword)}&location=Maroc&f_TPR=r86400`;
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(2000 + Math.random() * 2000);

      const cards = await page.$$eval('.job-search-card', cards =>
        cards.map(card => ({
          title: card.querySelector('.base-search-card__title')?.innerText?.trim() || '',
          company: card.querySelector('.base-search-card__subtitle')?.innerText?.trim() || '',
          location: card.querySelector('.job-search-card__location')?.innerText?.trim() || '',
          url: card.querySelector('a.base-card__full-link')?.href || '',
          id: card.getAttribute('data-entity-urn') || '',
        }))
      );

      jobs.push(...cards.filter(j => j.title && j.url));
      await page.waitForTimeout(3000 + Math.random() * 3000);

    } catch (err) {
      console.error(`LinkedIn error for "${keyword}":`, err.message);
    }
  }

  await browser.close();
  return jobs.map(j => ({ ...j, source: 'LinkedIn' }));
}

module.exports = { scrapeLinkedIn };