const { chromium } = require('playwright');
const config = require('../config');

async function scrapeAlkhdma() {
  const jobs = [];
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  for (const keyword of config.keywords.slice(0, 3)) {
    try {
      const url = `https://www.alkhdma.com/jobs?q=${encodeURIComponent(keyword)}`;
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(2000);

      const cards = await page.$$eval('.job-item', cards =>
        cards.map(card => ({
          title: card.querySelector('.job-title')?.innerText?.trim() || '',
          company: card.querySelector('.company-name')?.innerText?.trim() || '',
          location: card.querySelector('.job-location')?.innerText?.trim() || '',
          url: card.querySelector('a')?.href || '',
          id: card.getAttribute('data-id') || Math.random().toString(36).slice(2),
        }))
      );

      jobs.push(...cards.filter(j => j.title && j.url));
      await page.waitForTimeout(2000 + Math.random() * 2000);

    } catch (err) {
      console.error(`Alkhdma error for "${keyword}":`, err.message);
    }
  }

  await browser.close();
  return jobs.map(j => ({ ...j, source: 'Alkhdma' }));
}

module.exports = { scrapeAlkhdma };