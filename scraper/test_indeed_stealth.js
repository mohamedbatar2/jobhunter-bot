const { chromium } = require('playwright');

async function testIndeedStealth() {
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-infobars',
      '--window-size=1920,1080'
    ]
  });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
    locale: 'fr-FR',
    timezoneId: 'Africa/Casablanca'
  });
  const page = await context.newPage();
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  try {
    const url = 'https://ma.indeed.com/jobs?q=cybersecurite&l=Maroc';
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    console.log('Indeed Stealth status:', resp.status());
    console.log('Indeed title:', await page.title());
    const count = await page.$$eval('.job_seen_beacon, [data-jk]', el => el.length);
    console.log('Found jobs count:', count);
  } catch (err) {
    console.error('Indeed stealth error:', err.message);
  } finally {
    await browser.close();
  }
}

testIndeedStealth();
