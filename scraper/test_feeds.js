const axios = require('axios');

async function testFeeds() {
  // Test 1: Indeed RSS
  try {
    const r1 = await axios.get('https://ma.indeed.com/rss?q=cybers%C3%A9curit%C3%A9&l=Maroc', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    console.log('Indeed RSS status:', r1.status, 'len:', r1.data.length);
  } catch (e) {
    console.log('Indeed RSS error:', e.message);
  }

  // Test 2: Dreamjob.ma
  try {
    const r2 = await axios.get('https://www.dreamjob.ma/?s=cybersecurite', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    console.log('Dreamjob status:', r2.status, 'len:', r2.data.length);
  } catch (e) {
    console.log('Dreamjob error:', e.message);
  }

  // Test 3: Emploi.ma with proper headers
  try {
    const r3 = await axios.get('https://www.emploi.ma/recherche-jobs-maroc?f%5B0%5D=im_field_offre_metiers%3A31', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
        'Referer': 'https://www.google.com/'
      }
    });
    console.log('Emploi.ma status:', r3.status, 'len:', r3.data.length);
  } catch (e) {
    console.log('Emploi.ma error:', e.message);
  }
}

testFeeds();
