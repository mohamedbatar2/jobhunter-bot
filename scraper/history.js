const { chromium } = require('playwright');
const net = require('net');

function isPublicHttpUrl(value) {
  try {
    const parsed = new URL(value);
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;
    const host = parsed.hostname.toLowerCase();
    if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return false;
    if (net.isIP(host)) return false;
    return true;
  } catch {
    return false;
  }
}

async function fetchJobDescriptions(jobs, onProgress = async () => {}) {
  let browser;
  let succeeded = 0;
  let done = 0;
  const eligible = jobs.filter(job => isPublicHttpUrl(job.url));
  if (eligible.length === 0) return { succeeded, done: jobs.length };

  try {
    browser = await chromium.launch({ headless: true });
    let nextIndex = 0;
    const workers = Array.from({ length: Math.min(3, eligible.length) }, async () => {
      const page = await browser.newPage();
      await page.route('**/*', route => {
        const type = route.request().resourceType();
        return ['image', 'media', 'font'].includes(type) ? route.abort() : route.continue();
      });
      while (nextIndex < eligible.length) {
        const job = eligible[nextIndex++];
        try {
          await page.goto(job.url, { waitUntil: 'domcontentloaded', timeout: 15000 });
          const text = await page.locator('body').innerText({ timeout: 5000 }).catch(() => '');
          const cleaned = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 14000);
          if (cleaned.length > 250) {
            job.description = `Current posting content retrieved from the saved URL:\n${cleaned}`;
            succeeded++;
          }
        } catch (err) {
          console.warn(`[History] Could not fetch ${job.url}: ${err.message}`);
        } finally {
          done++;
          if (done % 20 === 0 || done === eligible.length) await onProgress(done, eligible.length, succeeded);
        }
      }
      await page.close().catch(() => {});
    });
    await Promise.all(workers);
  } catch (err) {
    console.error('[History] Browser fetch unavailable:', err.message);
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
  const skipped = jobs.length - eligible.length;
  done += skipped;
  return { succeeded, done };
}

module.exports = { fetchJobDescriptions };