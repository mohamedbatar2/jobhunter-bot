const axios = require('axios');

async function testRekruteDetail() {
  const url = 'https://www.rekrute.com/offre-emploi-chief-security-officer-recrutement-axa-services-maroc-rabat-186000.html';
  try {
    const resp = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      }
    });
    console.log('Rekrute status:', resp.status);
    console.log('Rekrute HTML len:', resp.data.length);
    // Find job description block on Rekrute
    // Rekrute usually has .blc or id="recruiterDescription" or .content
    const descMatch = resp.data.match(/<div[^>]+id="recruiterDescription"[^>]*>([\s\S]*?)<\/div>/i) ||
                      resp.data.match(/<div[^>]+class="blc"[^>]*>([\s\S]*?)<\/div>/i) ||
                      resp.data.match(/<div[^>]+class="col-md-12"[^>]*>([\s\S]*?)<\/div>/i);
    if (descMatch) {
      const clean = descMatch[1]
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<li[^>]*>/gi, '\n• ')
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      console.log('Rekrute extracted len:', clean.length);
      console.log('Snippet:', clean.slice(0, 300));
    } else {
      console.log('No specific container matched, total text len:', resp.data.length);
    }
  } catch (err) {
    console.error('Rekrute detail err:', err.message);
  }
}

testRekruteDetail();
