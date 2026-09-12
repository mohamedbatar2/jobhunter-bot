require('dotenv').config();
const axios = require('axios');
const config = require('./config');

async function analyzeJob(job) {
  const prompt = `Tu es un assistant de recherche d'emploi expert. Analyse cette offre pour Mohammed Batar.

OFFRE:
Titre: ${job.title}
Entreprise: ${job.company}
Localisation: ${job.location || 'Non précisé'}
Description: ${job.description || 'Non disponible'}
Source: ${job.source}
URL: ${job.url}

PROFIL CANDIDAT:
- Mohammed Batar, 22 ans, Casablanca, Maroc
- IT Analyst @ SYPEX (ERP fintech OPCI/OPCVM, Oracle 19c, SQL, JasperReports)
- Apprenti Cyberdefense @ DATAPROTECT (ELK Stack SIEM, NGFW, WAF, EDR, NAC)
- Ingénierie Cybersécurité @ CNAM Paris (ISO 27005, EBIOS, PSSI, SECOPS, ISO 27035)
- CompTIA Security+ certifié (Mai 2026)
- Compétences: SOC N1, SIEM/ELK, ASP.NET Core 8, Python, Docker Compose, PostgreSQL, n8n, GitHub Actions CI/CD, Active Directory, GPO
- Projets: BankingApp SOC Lab (ELK pipeline complet, simulation attaques), FinAudit (SaaS B2B API security, conformité BAM/AMMC)
- Convention de stage CNAM Paris disponible
- Langues: Arabe (natif), Français (professionnel), Anglais (courant)

RÈGLES DE SCORING (nombre entier entre 1 et 10):
- 9-10: Junior/Débutant/Stage/Alternance explicite + compétences correspondent à 80%+
- 7-8: Pas de mention de niveau + compétences correspondent à 60%+
- 5-6: Compétences partielles ou 1-3 ans demandés
- 3-4: Senior/Lead ou 3-5 ans requis (gap important mais candidature possible)
- 1-2: Manager/Architect/+5 ans ou poste hors domaine total

RÈGLES D'EXCLUSION AUTOMATIQUE (score max 3):
- Poste basé hors Maroc ET pas de remote explicite
- Alternance France sans convention explicite
- Java/Angular comme compétence principale
- Automotive/OT/industriel pur

SÉLECTION DU CV:
- cv_thales: SOC, Blue Team, SIEM, cyberdéfense, analyste sécurité, threat detection
- cv_cfg: GRC, audit SI, conformité, EBIOS, ISO 27005, banque, finance, risk management
- cv_cegid: développeur .NET, ASP.NET Core, backend, API, fullstack
- cv_exploitation: exploitation IT, infrastructure, support N1/N2, sysadmin, ops
- cv_general: tout autre cas, poste mixte, ou si aucune catégorie ne correspond

Réponds UNIQUEMENT en JSON valide, sans markdown, sans backticks, sans commentaires:
{
  "match_score": 7,
  "match_reason": "explication courte pourquoi ce score",
  "gaps": ["gap1", "gap2"],
  "remote": true,
  "cv_recommande": "cv_thales",
  "fiche": {
    "poste": "",
    "entreprise": "",
    "localisation": "",
    "type_contrat": "CDI|CDD|Stage|Alternance|Freelance",
    "salaire": "montant ou Non précisé",
    "competences_requises": ["skill1", "skill2"],
    "points_forts": ["point1", "point2"],
    "langue_requise": "FR|EN|AR|Bilingue"
  },
  "draft_email": {
    "objet": "",
    "corps": ""
  }
}`;

  try {
    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        }
      }
    );

    const text = response.data.choices[0].message.content;
    const clean = text.replace(/```json|```/g, '').trim();
    const analysis = JSON.parse(clean);
    analysis.match_score = parseInt(analysis.match_score);
    return analysis;

  } catch (err) {
    console.error('Groq error:', JSON.stringify(err.response?.data) || err.message);
    return null;
  }
}

module.exports = { analyzeJob };
