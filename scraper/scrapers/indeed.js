const { chromium } = require('playwright');
const config = require('../config');

async function scrapeIndeed() {
    const jobs = [];
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    await page.setExtraHTTPHeaders({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    });

    for (const keyword of config.keywords.slice(0, 4)) {
        try {
            const url = `https://ma.indeed.com/jobs?q=${encodeURIComponent(keyword)}&l=Maroc`;
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
            await page.waitForTimeout(2000 + Math.random() * 2000);

            const cards = await page.$$eval('.job_seen_beacon', cards =>
                cards.map(card => ({
                    title: card.querySelector('.jobTitle span')?.innerText?.trim() || '',
                    company: card.querySelector('.companyName')?.innerText?.trim() || '',
                    location: card.querySelector('.companyLocation')?.innerText?.trim() || '',
                    url: 'https://ma.indeed.com' + (card.querySelector('a.jcs-JobTitle')?.getAttribute('href') || ''),
                    id: card.getAttribute('data-jk') || '',
                }))
            );

            jobs.push(...cards.filter(j => j.title && j.url));
            await page.waitForTimeout(3000 + Math.random() * 3000);

        } catch (err) {
            console.error(`Indeed error for "${keyword}":`, err.message);
        }
    }

    await browser.close();
    return jobs.map(j => ({ ...j, source: 'Indeed' }));
}

module.exports = { scrapeIndeed };