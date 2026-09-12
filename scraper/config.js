require('dotenv').config();

module.exports = {
    telegram: {
        token: process.env.TELEGRAM_TOKEN,
        chatId: process.env.TELEGRAM_CHAT_ID,
    },
    keywords: [
        'SOC Analyst', 'Cybersecurity Engineer', 'IT Security',
        'Analyste Sécurité', 'Ingénieur Sécurité', 'Cyberdefense',
        'Security Operations', 'SIEM', 'stage cybersécurité',
        'alternance sécurité', 'penetration tester'
    ],
    locations: ['Casablanca', 'Rabat', 'Maroc', 'Remote'],
    contractTypes: ['CDI', 'CDD', 'Stage', 'Alternance', 'CI'],
    groqKey: process.env.GROQ_API_KEY,
};