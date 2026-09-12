const fs = require('fs');
const path = require('path');
const axios = require('axios');

const dir = '../n8n-data/workflows';
const API_KEY = 'ta_cle_api_ici';
const BASE_URL = 'http://localhost:5678/api/v1/workflows';

async function run() {
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
    let imported = 0, skipped = 0;

    for (const file of files) {
        try {
            const wf = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
            if (!wf.name) { skipped++; continue; }

            await axios.post(BASE_URL, {
                name: wf.name,
                nodes: wf.nodes || [],
                connections: wf.connections || {},
                settings: wf.settings || {},
                active: false
            }, {
                headers: { 'X-N8N-API-KEY': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3NjdjOTIwOS04ZDU1LTRiOGUtOTA0ZS01OGIzNGMyNjM5NzkiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiZTA3NjgxODctZGY0NS00YjQ5LTlhYmQtNDhmZTY4MDhhNDM4IiwiaWF0IjoxNzc4MTA0NTc0LCJleHAiOjE3ODA2MTQwMDB9.JPvQulta50Jc2PEUrWRd5xqwD5G2mycJVL0lmas0ulg' }
            });

            imported++;
            if (imported % 50 === 0) console.log(`Imported: ${imported}...`);

        } catch (e) {
            skipped++;
        }
    }
    console.log(`Done. Imported: ${imported} | Skipped: ${skipped}`);
}

run();