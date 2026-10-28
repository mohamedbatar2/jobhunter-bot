const axios = require('axios');

async function testSearch(query) {
  const url = `https://www.alkhdma.com/jobs?q=${encodeURIComponent(query)}`;
  console.log('Fetching:', url);
  try {
    const resp = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    });
    const html = resp.data;
    const re = /<a[^>]*href="(\/jobs\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
    let match;
    const items = [];
    while ((match = re.exec(html)) !== null) {
      const link = match[1];
      const inner = match[2];
      const titleMatch = inner.match(/<h2[^>]*>([\s\S]*?)<\/h2>/);
      const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : '';
      
      const companyMatch = inner.match(/<span class="flex-1">([\s\S]*?)<\/span>/);
      const company = companyMatch ? companyMatch[1].replace(/<[^>]+>/g, '').trim() : '';
      
      const sectorMatch = inner.match(/<span class="flex flex-col">([^<]+)<\/span>/);
      const sector = sectorMatch ? sectorMatch[1].trim() : '';

      if (title && link) {
        items.push({ title, company, sector, link });
      }
    }
    console.log(`Found ${items.length} jobs for query "${query}":`);
    console.log(items.slice(0, 5));
    return items;
  } catch (err) {
    console.error('Error:', err.message);
  }
}

async function run() {
  await testSearch('informatique');
  await testSearch('securite');
  await testSearch('aya'); // check if filtering by keyword works
}

run();

