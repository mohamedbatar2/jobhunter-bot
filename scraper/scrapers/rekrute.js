const { chromium } = require('playwright');
const config = require('../config');

async function scrapeRekrute() {
  const jobs = [];
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  for (const keyword of config.keywords.slice(0, 3)) {
    try {
      const url = `https://www.rekrute.com/offres.html?s=1&p=1&query=${encodeURIComponent(keyword)}`;
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(2000);

      const cards = await page.$$eval('.post-id', cards =>
        cards.map(card => ({
          title: card.querySelector('h2 a')?.innerText?.trim() || '',
          company: card.querySelector('.company-name')?.innerText?.trim() || '',
          location: card.querySelector('.location')?.innerText?.trim() || '',
          url: 'https://www.rekrute.com' + (card.querySelector('h2 a')?.getAttribute('href') || ''),
          id: card.getAttribute('id') || '',
        }))
      );

      jobs.push(...cards.filter(j => j.title && j.url));
      await page.waitForTimeout(2000 + Math.random() * 2000);

    } catch (err) {
      console.error(`Rekrute error for "${keyword}":`, err.message);
    }
  }

  await browser.close();
  return jobs.map(j => ({ ...j, source: 'Rekrute' }));
}

module.exports = { scrapeRekrute };