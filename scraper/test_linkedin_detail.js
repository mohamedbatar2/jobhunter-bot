const axios = require('axios');

async function testLinkedInExtraction() {
  const jobId = '4460476992';
  const url = `https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${jobId}`;
  const resp = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7'
    }
  });

  const html = resp.data;
  const match = html.match(/<div class="show-more-less-html__markup[^"]*">([\s\S]*?)<\/div>/i) ||
                html.match(/<section class="show-more-less-html[^"]*">([\s\S]*?)<\/section>/i) ||
                html.match(/<div class="description__text[^"]*">([\s\S]*?)<\/div>/i);

  if (match) {
    const text = match[1]
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<li[^>]*>/gi, '\n• ')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&nbsp;/g, ' ')
      .trim();
    console.log('Extracted Description length:', text.length);
    console.log('Description sample:\n', text.slice(0, 600));
  } else {
    console.log('No description match found in HTML');
  }
}

testLinkedInExtraction();
