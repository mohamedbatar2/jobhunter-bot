const axios = require('axios');

async function inspectAlkhdma() {
  try {
    const resp = await axios.get('https://www.alkhdma.com/jobs?q=securite', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    const match = resp.data.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (match) {
      console.log('Found __NEXT_DATA__!');
      const data = JSON.parse(match[1]);
      console.log('pageProps keys:', Object.keys(data.props?.pageProps || {}));
      if (data.props?.pageProps?.jobs) {
        console.log('Jobs count:', data.props.pageProps.jobs.length);
        console.log('Sample job:', JSON.stringify(data.props.pageProps.jobs[0], null, 2));
      } else {
        console.log('pageProps keys:', Object.keys(data.props?.pageProps || {}));
        console.log('sample pageProps:', JSON.stringify(data.props?.pageProps).slice(0, 500));
      }
    } else {
      console.log('No __NEXT_DATA__');
      // Look for any links with /job or /offres
      const links = resp.data.match(/href="([^"]*(?:job|offre)[^"]*)"/g);
      console.log('Links found:', links ? links.slice(0, 10) : 'none');
    }
  } catch (err) {
    console.error('Inspect error:', err.message);
  }
}

inspectAlkhdma();
