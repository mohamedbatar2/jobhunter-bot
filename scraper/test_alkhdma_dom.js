const axios = require('axios');

async function inspectAlkhdmaDOM() {
  const resp = await axios.get('https://www.alkhdma.com/jobs?q=informatique', {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
  });
  const html = resp.data;
  const re = /<a href="(\/jobs\/[^"]+)">([\s\S]*?)<\/a>/g;
  let match;
  let count = 0;
  while ((match = re.exec(html)) !== null && count < 2) {
    count++;
    console.log(`\n=== Card ${count}: ${match[1]} ===`);
    console.log(match[2].replace(/<svg[\s\S]*?<\/svg>/g, '[SVG]').replace(/\s+/g, ' '));
  }
}

inspectAlkhdmaDOM();
