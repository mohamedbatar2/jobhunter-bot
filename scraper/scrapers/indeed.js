const { chromium } = require('playwright');
const config = require('../config');

/**
 * Scrapes job listings from Indeed Morocco (ma.indeed.com) with anti-bot stealth
 * and updated DOM selectors compatible with modern Indeed layout.
 */
async function scrapeIndeed() {
  const jobs = [];
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu'
    ]
  });

  // Use top monitored keywords
  const keywords = (config.keywords || [
    'Technicien Systèmes et Réseaux',
    'Technicien Support Informatique',
    'Support IT',
    'Helpdesk'
  ]).slice(0, 5);

  const seenIds = new Set();

  for (const keyword of keywords) {
    let context = null;
    try {
      context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        viewport: {
          width: 1366 + Math.floor(Math.random() * 200),
          height: 768 + Math.floor(Math.random() * 100)
        },
        locale: 'fr-FR',
        timezoneId: 'Africa/Casablanca',
        extraHTTPHeaders: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
          'Sec-Ch-Ua': '"Not/A)Brand";v="8", "Chromium";v="126", "Google Chrome";v="126"',
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': '"Windows"',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1'
        }
      });

      const page = await context.newPage();
      await page.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        window.chrome = { runtime: {} };
      });

      const url = `https://ma.indeed.com/jobs?q=${encodeURIComponent(keyword)}&l=Maroc&sort=date`;
      const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });

      if (resp && resp.status() === 200 && !(await page.title()).includes('Security Check')) {
        await page.waitForTimeout(2000 + Math.random() * 1500);

        const items = await page.$$eval('[data-jk], .cardOutline, .job_seen_beacon', elements => {
          const list = [];
          const internalSeen = new Set();

          for (const el of elements) {
            const link = el.querySelector('a.jcs-JobTitle') || el.querySelector('a[data-jk]');
            const rawHref = link?.getAttribute('href') || '';
            const jk = link?.getAttribute('data-jk')
                    || el.getAttribute('data-jk')
                    || (rawHref.match(/jk=([a-zA-Z0-9]+)/) ? rawHref.match(/jk=([a-zA-Z0-9]+)/)[1] : '');

            if (!jk || internalSeen.has(jk)) continue;
            internalSeen.add(jk);

            const container = el.closest('.cardOutline') || el.closest('.job_seen_beacon') || el;
            
            const title = container.querySelector('.jobTitle span, a.jcs-JobTitle span, h2.jobTitle')?.innerText?.trim()
                       || link?.innerText?.trim()
                       || el.getAttribute('aria-label')?.replace(/^tous les détails sur «\s*/i, '')?.replace(/\s*»$/i, '')?.trim()
                       || '';

            const company = container.querySelector('[data-testid="company-name"], .companyName, span[data-testid="company-name"]')?.innerText?.trim()
                         || 'Entreprise confidentielle';

            const location = container.querySelector('[data-testid="text-location"], .companyLocation, div[data-testid="text-location"]')?.innerText?.trim()
                          || 'Maroc';

            const snippet = container.querySelector('.job-snippet, [data-testid="job-snippet"], .underShelfFooter')?.innerText?.trim() || '';

            const jobUrl = rawHref.startsWith('http') ? rawHref : `https://ma.indeed.com${rawHref}`;

            if (title && jk) {
              list.push({
                id: `indeed_${jk}`,
                title,
                company,
                location,
                url: jobUrl,
                description: snippet,
                source: 'Indeed'
              });
            }
          }
          return list;
        });

        for (const item of items) {
          if (!seenIds.has(item.id)) {
            seenIds.add(item.id);
            jobs.push(item);
          }
        }
      } else {
        console.warn(`[Indeed] Page inaccessible ou contrôle de sécurité pour "${keyword}" (Status: ${resp?.status()})`);
      }
    } catch (err) {
      console.error(`Indeed error for "${keyword}":`, err.message);
    } finally {
      if (context) {
        await context.close().catch(() => {});
      }
    }

    // Respectful delay between keyword queries
    await new Promise(r => setTimeout(r, 2000 + Math.random() * 1500));
  }

  await browser.close().catch(() => {});
  return jobs;
}

module.exports = { scrapeIndeed };