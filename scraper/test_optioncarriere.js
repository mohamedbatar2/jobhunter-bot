const axios = require('axios');

async function testOptionCarriere() {
  try {
    const url = 'https://www.optioncarriere.ma/recherche/emplois?s=cybersecurite&l=Maroc';
    const resp = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      }
    });
    console.log('Optioncarriere status:', resp.status, 'len:', resp.data.length);
    const hasJobs = resp.data.includes('job') || resp.data.includes('offre');
    console.log('Has job mentions:', hasJobs);
    // Let's see article or job class
    const matches = resp.data.match(/<article[^>]+class="[^"]*job[^"]*"[\s\S]*?<\/article>/g);
    console.log('Article job matches:', matches ? matches.length : 0);
  } catch (err) {
    console.log('Optioncarriere error:', err.message);
  }
}

testOptionCarriere();
