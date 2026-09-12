const axios = require('axios');

async function testDreamjob() {
  const r = await axios.get('https://www.dreamjob.ma/?s=cybersecurite', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });
  const html = r.data;
  // Look for any links with href
  const matches = [];
  const re = /<a\s+[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const href = m[1];
    const text = m[2].replace(/<[^>]+>/g, '').trim();
    if (href.includes('dreamjob.ma/') && text.length > 15 && !href.includes('/category/') && !href.includes('/author/')) {
      matches.push({ href, text });
    }
  }
  console.log('Total articles found:', matches.length);
  matches.slice(0, 8).forEach(item => console.log(item));
}

testDreamjob();
