const { chromium } = require('playwright');
const axios = require('axios');

async function testLinkedIn() {
  console.log('\n--- Testing LinkedIn ---');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  });
  try {
    const url = 'https://www.linkedin.com/jobs/search/?keywords=SOC%20Analyst&location=Maroc&f_TPR=r86400';
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);
    const jobs = await page.$$eval('.base-card, .job-search-card', cards =>
      cards.slice(0, 3).map(c => ({
        title: c.querySelector('.base-search-card__title')?.innerText?.trim(),
        company: c.querySelector('.base-search-card__subtitle')?.innerText?.trim(),
        location: c.querySelector('.job-search-card__location')?.innerText?.trim(),
        url: c.querySelector('a.base-card__full-link')?.href,
        urn: c.getAttribute('data-entity-urn')
      }))
    );
    console.log('LinkedIn scraped sample:', jobs);
  } catch (err) {
    console.error('LinkedIn err:', err.message);
  } finally {
    await browser.close();
  }
}

async function testRekrute() {
  console.log('\n--- Testing Rekrute ---');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    const url = 'https://www.rekrute.com/offres.html?s=1&p=1&query=cybersecurite';
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);
    const cards = await page.$$eval('.post-id', cards =>
      cards.slice(0, 3).map(c => ({
        title: c.querySelector('h2 a')?.innerText?.trim(),
        company: c.querySelector('.company-name, img[alt]')?.innerText?.trim() || c.querySelector('img')?.getAttribute('alt'),
        location: c.querySelector('.location, em')?.innerText?.trim(),
        desc: c.querySelector('.blc, .info, p')?.innerText?.trim()?.slice(0, 100),
        url: c.querySelector('h2 a')?.getAttribute('href'),
        id: c.getAttribute('id')
      }))
    );
    console.log('Rekrute scraped sample:', cards);
  } catch (err) {
    console.error('Rekrute err:', err.message);
  } finally {
    await browser.close();
  }
}

async function testIndeed() {
  console.log('\n--- Testing Indeed ---');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  });
  try {
    const url = 'https://ma.indeed.com/jobs?q=cybersecurite&l=Maroc';
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    console.log('Indeed status:', resp.status());
    console.log('Indeed title:', await page.title());
    const cards = await page.$$eval('.job_seen_beacon', cards =>
      cards.slice(0, 3).map(c => ({
        title: c.querySelector('.jobTitle span')?.innerText?.trim(),
        company: c.querySelector('[data-testid="company-name"], .companyName')?.innerText?.trim(),
        location: c.querySelector('[data-testid="text-location"], .companyLocation')?.innerText?.trim(),
        url: c.querySelector('a.jcs-JobTitle')?.getAttribute('href'),
        id: c.getAttribute('data-jk')
      }))
    );
    console.log('Indeed scraped sample:', cards);
  } catch (err) {
    console.error('Indeed err:', err.message);
  } finally {
    await browser.close();
  }
}

async function testAlkhdma() {
  console.log('\n--- Testing Alkhdma ---');
  try {
    const resp = await axios.get('https://www.alkhdma.com/jobs?q=securite', { timeout: 8000 });
    console.log('Alkhdma status:', resp.status);
  } catch (err) {
    console.error('Alkhdma err:', err.message);
  }
}

(async () => {
  await testLinkedIn();
  await testRekrute();
  await testIndeed();
  await testAlkhdma();
})();
