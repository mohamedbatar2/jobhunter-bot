const { chromium } = require('playwright');

async function test() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on('request', req => {
    const url = req.url();
    if (!url.includes('.png') && !url.includes('.jpg') && !url.includes('.css') && !url.includes('.woff')) {
      console.log('REQ:', req.method(), url);
    }
  });

  page.on('response', async res => {
    const url = res.url();
    if (url.includes('api') || url.includes('job') || url.includes('search')) {
      try {
        const ct = res.headers()['content-type'] || '';
        if (ct.includes('json')) {
          const body = await res.text();
          console.log('JSON RESP from', url, ':', body.slice(0, 300));
        }
      } catch (e) {}
    }
  });

  console.log('Navigating to https://www.alkhdma.com/jobs...');
  await page.goto('https://www.alkhdma.com/jobs', { waitUntil: 'networkidle', timeout: 30000 });

  // Type in the search input
  console.log('Typing in search input...');
  const input = await page.$('input[placeholder*="Recherche"]');
  if (input) {
    await input.fill('informatique');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(3000);
  } else {
    console.log('Input not found');
  }

  // Check what cards are visible now
  const links = await page.$$eval('a[href^="/jobs/"]', els => els.map(e => ({
    href: e.getAttribute('href'),
    text: e.innerText.replace(/\s+/g, ' ')
  })));
  console.log('Visible cards after search:', links.length);
  console.log('First 5:', links.slice(0, 5));

  await browser.close();
}

test().catch(console.error);
