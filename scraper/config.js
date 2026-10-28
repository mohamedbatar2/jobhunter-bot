require('dotenv').config();

module.exports = {
    telegram: {
        token: process.env.TELEGRAM_TOKEN,
        chatId: process.env.TELEGRAM_CHAT_ID,
    },
    keywords: [
        'Technicien Systèmes et Réseaux', 'Technicien Support Informatique',
        'Technicien Informatique', 'Helpdesk', 'Support IT',
        'Administrateur Systèmes et Réseaux', 'Gestion de parc informatique',
        'Technicien Réseau', 'GLPI', 'Technicien maintenance informatique',
        'Stage Systèmes et Réseaux', 'Stage Informatique',
        'Junior .NET Developer', 'Développeur C#', 'ASP.NET Core',
        'Développeur Backend', 'Développeur Python', 'Développeur API'
    ],
    locations: ['Casablanca', 'Rabat', 'Maroc', 'Remote'],
    contractTypes: ['CDI', 'CDD', 'Stage', 'Alternance', 'CI'],
    groqKey: process.env.GROQ_API_KEY,
};