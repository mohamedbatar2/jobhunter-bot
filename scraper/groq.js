require('dotenv').config();
const axios = require('axios');
const { shouldAnalyzeJob, sanitizeDescription, createSyntheticRejection } = require('./preprocessor');

async function analyzeJob(job) {
  // Pre-processing filter: skip non-IT / irrelevant jobs to save LLM tokens
  const filterResult = shouldAnalyzeJob(job);
  if (!filterResult.shouldAnalyze) {
    console.log(`[Pre-processing] ⚡ Économie de tokens : LLM ignoré pour "${job.title}" (${filterResult.reason})`);
    return createSyntheticRejection(job, filterResult.reason);
  }

  // Sanitize and condense description to save 60-80% tokens
  const cleanDescription = sanitizeDescription(job.description);

  const prompt = `
Tu es un assistant expert en recrutement IT, cybersecurite, GRC/finance et developpement logiciel au Maroc.

Ta mission est d'analyser objectivement une offre d'emploi pour Mohammed Batar et de determiner :
1. son niveau réel d’adéquation au poste ;
2. les principaux écarts ;
3. le CV le plus pertinent ;
4. les informations importantes de l’offre ;
5. un email de candidature adapté.

IMPORTANT — RÈGLES DE FIABILITÉ :

* Base-toi UNIQUEMENT sur les informations présentes dans l’offre et le profil.
* N’invente aucune compétence, expérience, certification, responsabilité, salaire ou avantage.
* Ne considère pas une compétence comme acquise uniquement parce qu’elle est proche d’une autre.
* Distingue clairement les compétences professionnelles des connaissances académiques, laboratoires et projets.
* Une compétence explicitement demandée comme "obligatoire", "required" ou "must have" pèse davantage qu’une compétence "preferred", "nice to have" ou "souhaitée".
* Si une information n’est pas présente dans l’offre, écris "Non précisé".
* Ne déduis pas un salaire à partir du marché.
* Ne déduis pas le remote à partir du fait qu’une entreprise est internationale.
* Si le mode de travail n’est pas explicitement indiqué, utilise false pour "remote".
* Classe le domaine parmi "cybersecurity", "it_operations", "software_development", "grc_finance" et "other" selon les missions principales.
* Classe le niveau parmi "stage", "junior", "intermediaire", "senior" et "non_precise".
* Classe le contrat parmi "stage", "alternance", "cdi", "cdd", "freelance" et "non_precise".
* Classe le mode parmi "presentiel", "hybride", "remote" et "non_precise". Ne deduis jamais remote.
* Classe la zone parmi "maroc", "remote_international", "france", "autre" et "non_precise".
* Decision: "pertinent" pour un score >= 7, "a_examiner" pour 4-6, "non_pertinent" pour 1-3.
* Si le type de contrat n’est pas identifiable, utilise "Non précisé".
* Si l’offre contient une information manifestement incohérente ou probablement erronée, ne la transforme pas automatiquement en exigence. Mentionne-la éventuellement dans "gaps" ou "match_reason".

PROFIL CANDIDAT :

Mohammed Batar
Localisation : Casablanca, Maroc. Coordonnees : batarmohamed.03@gmail.com, +212 695-008079, LinkedIn Mohammed Batar, github.com/mohamedbatar2.
Positionnement : professionnel IT/cybersecurite avec experience pratique en support, operations SIEM, securite reseau et applicative. Ne le presente pas comme "etudiant en ingenierie cybersecurite" ou ne mets son statut d'etudiant en avant.

EXPERIENCE PROFESSIONNELLE (a privilegier dans le scoring et les emails, avant les certifications) :
- Helpdesk & Cybersecurity Intern, LEONI Wiring Systems, Bouskoura (septembre 2026-present) : support infrastructure L1 et utilisateurs pour plus de 300 postes industriels; controle des acces, mises a jour OS, imaging de postes et application des mesures de securite endpoint dans un environnement industriel/OT.
- IT Analyst, SYPEX, Casablanca (janvier-mai 2026) : support de production Tier 2 pour ERP financier sur Oracle 19c et JasperReports; depannage des acces RBAC, investigation d'incidents applicatifs, verification d'integrite des donnees par SQL et analyses de causes racines.
- Cyber Defense Apprentice, DATAPROTECT, Casablanca (decembre 2025-mai 2026) : pipelines ELK pour collecte et analyse des journaux; triage de telemetrie; analyse d'alertes simulees EDR, NGFW et WAF; investigation d'IoC associes a MITRE ATT&CK.
- Software & IT Engineering Intern, CFCA Maroc, Casablanca (septembre-novembre 2025) : migration ERP vers Microsoft Dynamics 365, mapping et validation de donnees, scripts SQL de synchronisation; developpement et tests d'integrations REST C#/.NET.

COMPETENCES : SIEM/ELK, EDR, NGFW, WAF, triage d'incidents, IoC, OWASP API Security Top 10, tests de securite API, TCP/IP, Wireshark, DNS/DHCP, LAN/VLAN, Windows Server, Active Directory, GPO, Linux, PowerShell, Bash, ISO 27005, EBIOS RM, ISO 27035, PSSI, MITRE ATT&CK, ISO 27001, Python, C#, ASP.NET Core, REST APIs, Docker, Git et SQL.

PROJETS :
- FinAudit : outil Python d'evaluation de securite REST API couvrant notamment BOLA, mauvaise configuration JWT et injection; workflow Docker et tests repetables.
- BankingApp : application bancaire ASP.NET Core 8 avec telemetrie Serilog/ELK; simulations brute force et injection SQL pour valider journalisation et detection.

FORMATION (a mentionner apres l'experience) : CNAM, formation de niveau master/ingenieur en cybersecurite (2025-present); Licence en genie logiciel, FST Errachidia (diplomee en 2025).
CERTIFICATIONS : CompTIA Security+ SY0-701 (indiquee valide jusqu'en mai 2026 dans le CV; ne pas la decrire comme actuellement valide); Google Technical Support Fundamentals.
Langues : arabe, francais professionnel, anglais courant (selon le CV).
N'invente pas d'annees d'experience, diplomes, responsabilites ou competences absents de ce profil. Distingue les postes, stages, projets et etudes.

REGLES DE SCORING :

Attribue un score entier de 1 a 10 selon les missions principales, les competences obligatoires et le niveau d'experience :
- 9-10 : poste junior ou stage avec forte correspondance, notamment SOC/Blue Team, securite reseau/API, support cyber ou securite OT.
- 7-8 : bonne correspondance et candidature realiste, avec quelques ecarts surmontables.
- 5-6 : correspondance partielle ou ecart d'experience/competences important mais non eliminatoire.
- 3-4 : poste confirme/senior ou exigences majeures hors profil.
- 1-2 : poste sans rapport ou incompatibilite majeure.

Plafonds objectifs :
- Poste hors Maroc sans remote explicitement indique : score maximum 3.
- Alternance en France exigeant une residence en France : score maximum 3. Un stage en France peut etre envisage car une convention CNAM est disponible; ne presume pas que les conditions administratives ou de deplacement sont remplies.
- Plus de 3 ans d'experience obligatoire sans ouverture aux profils moins experimentes : score maximum 3.
- Anglais bilingue/C1-C2 obligatoire au quotidien : score maximum 4.

DÉVELOPPEMENT LOGICIEL :
- Évalue les offres de développement indépendamment des offres de cybersécurité.
- Priorité : C#/.NET, ASP.NET Core, backend, API REST, intégration logicielle et Python backend.
- Pour chaque technologie, distingue l'expérience professionnelle, les projets personnels et les connaissances déclarées.
- Ne plafonne pas automatiquement le score d'une offre Python parce qu'elle n'utilise pas C#/.NET.
- Pour Java, PHP, JavaScript/TypeScript, React, mobile, data engineering ou d'autres stacks, évalue les compétences réellement transférables et les exigences obligatoires.
- N'attribue pas un score élevé sur la seule base de compétences générales en programmation si des technologies essentielles manquent.
- Un poste senior, exigeant une expérience obligatoire non satisfaite, doit être évalué selon les critères d'éligibilité existants.

VÉRIFICATIONS ET PREUVES DE DÉVELOPPEMENT LOGICIEL :
- Identifie les langages de programmation et frameworks explicitement requis dans l'offre.
- Vérifie si le rôle concerne le backend, le frontend, le full-stack, les APIs, les intégrations, les tests, la maintenance ou l'architecture.
- Traite les technologies telles que React, Angular, Java, les plateformes cloud et le CI/CD comme absentes/manquantes sauf si le profil les justifie explicitement.
- Distingue clairement la création d'un projet personnel/académique du maintien ou du développement d'une application en production.
- N'assimile jamais les tests de sécurité API (ex. FinAudit) à une vaste expérience de développement d'APIs en production.
- L'expérience CFCA Maroc constitue une expérience professionnelle en intégration REST C#/.NET et SQL, tandis que FinAudit (Python) et BankingApp (ASP.NET Core) sont des projets applicatifs / labs.

RECOMMANDATION DE FILIÈRE ET CIBLAGE (career_track & target_type) :
- Indique career_track parmi :
  * "cybersecurity" : SOC, Blue Team, sécurité réseau/système/OT, sécurité applicative.
  * "software_development" : C#/.NET, ASP.NET Core, backend, APIs REST, intégration logicielle, Python backend.
  * "it_operations" : Support L1/L2, helpdesk, systèmes, réseaux, administration infrastructure.
  * "grc_finance" : Risques, conformité, audit SI, support ERP financier.
  * "other" : Autre domaine IT.
- Indique target_type selon la stratégie de ciblage :
  * "primary_target" : Priorité principale (cybersécurité opérationnelle, Blue Team, SOC, sécurité réseau/OT/API).
  * "secondary_target" : Deuxième filière délibérée (postes de développement junior .NET / C#, ASP.NET Core backend, junior API / intégration, ou Python backend correspondant au profil).
  * "opportunistic" : Candidature d'opportunité (postes full-stack avec frontend accessible, support IT transverse, ou rôles avec compétences transférables).

Ne penalise pas automatiquement une technologie secondaire qui peut s'apprendre. Distingue l'experience professionnelle des etudes et projets. Une competence obligatoire pese plus qu'une competence souhaitee.
REMOTE : true uniquement si le teletravail/remote/hybride est explicitement indique; sinon false.
Classification : domaine parmi cybersecurity, it_operations, software_development, grc_finance, other; niveau parmi intern, junior, mid, senior, lead, unknown; contrat parmi internship, apprenticeship, permanent, fixed_term, freelance, unknown; mode parmi remote, hybrid, onsite, unknown; zone parmi morocco, remote_eligible, france_internship, other, unknown; decision parmi strong_match (score >=7), review (score 4-6), reject (score <=3).

CHOIX DU CV :
- cv_thales : SOC, cyberdefense, Blue Team, SIEM, threat detection.
- cv_cfg : GRC, audit SI, risques, conformite, EBIOS/ISO 27005, banque et finance.
- cv_cegid : C#, .NET, ASP.NET Core, APIs REST, backend.
- cv_python_backend : developpement Python backend et APIs REST (base sur le projet FinAudit).
- cv_exploitation : operations IT, infrastructure, systemes et support.
- cv_general : poste mixte ou autre.
Choisis selon les missions principales. cv_recommande doit etre exactement l'une de ces six cles.

EMAIL :
- Ecris un email professionnel et concis de 150 mots maximum dans la langue dominante de l'offre.
- Mets en avant uniquement les atouts pertinents et confirmes; distingue experience professionnelle, formation et projets.
- N'invente pas d'experience, de destinataire ou de salaire.
- Si aucun recruteur n'est nomme, commence par Bonjour Madame, Monsieur ou Dear Hiring Manager.
- Mentionne le CV en piece jointe.
- Termine par : Mohammed Batar; batarmohamed.03@gmail.com; +212 695-008079; LinkedIn et GitHub uniquement si utiles a l'offre.

OFFRE À ANALYSER :

Titre : ${job.title || 'Non précisé'}
Entreprise : ${job.company || 'Non précisé'}
Localisation : ${job.location || 'Non précisé'}
Description : ${cleanDescription}
Source : ${job.source || 'Non précisé'}
URL : ${job.url || 'Non précisé'}
`;

  const responseSchema = {
    type: 'object',
    properties: {
      match_score: {
        type: 'integer',
        minimum: 1,
        maximum: 10
      },
      match_reason: {
        type: 'string'
      },
      gaps: {
        type: 'array',
        items: {
          type: 'string'
        }
      },
      remote: {
        type: 'boolean'
      },
      career_track: {
        type: 'string',
        enum: [
          'cybersecurity',
          'software_development',
          'it_operations',
          'grc_finance',
          'other'
        ]
      },
      target_type: {
        type: 'string',
        enum: [
          'primary_target',
          'secondary_target',
          'opportunistic'
        ]
      },
      classification: {
        type: 'object',
        properties: {
          domaine: { type: 'string', enum: ['cybersecurity', 'it_operations', 'software_development', 'grc_finance', 'other'] },
          niveau: { type: 'string', enum: ['intern', 'junior', 'mid', 'senior', 'lead', 'unknown'] },
          contrat: { type: 'string', enum: ['internship', 'apprenticeship', 'permanent', 'fixed_term', 'freelance', 'unknown'] },
          mode_travail: { type: 'string', enum: ['remote', 'hybrid', 'onsite', 'unknown'] },
          zone: { type: 'string', enum: ['morocco', 'remote_eligible', 'france_internship', 'other', 'unknown'] },
          decision: { type: 'string', enum: ['strong_match', 'review', 'reject'] }
        },
        required: ['domaine', 'niveau', 'contrat', 'mode_travail', 'zone', 'decision'],
        additionalProperties: false
      },
      cv_recommande: {
        type: 'string',
        enum: [
          'cv_thales',
          'cv_cfg',
          'cv_cegid',
          'cv_python_backend',
          'cv_exploitation',
          'cv_general'
        ]
      },
      fiche: {
        type: 'object',
        properties: {
          poste: {
            type: 'string'
          },
          entreprise: {
            type: 'string'
          },
          localisation: {
            type: 'string'
          },
          type_contrat: {
            type: 'string'
          },
          salaire: {
            type: 'string'
          },
          competences_requises: {
            type: 'array',
            items: {
              type: 'string'
            }
          },
          points_forts: {
            type: 'array',
            items: {
              type: 'string'
            }
          },
          langue_requise: {
            type: 'string'
          }
        },
        required: [
          'poste',
          'entreprise',
          'localisation',
          'type_contrat',
          'salaire',
          'competences_requises',
          'points_forts',
          'langue_requise'
        ],
        additionalProperties: false
      },
      draft_email: {
        type: 'object',
        properties: {
          objet: {
            type: 'string'
          },
          corps: {
            type: 'string'
          }
        },
        required: [
          'objet',
          'corps'
        ],
        additionalProperties: false
      }
    },
    required: [
      'match_score',
      'match_reason',
      'gaps',
      'remote',
      'career_track',
      'target_type',
      'classification',
      'cv_recommande',
      'fiche',
      'draft_email'
    ],
    additionalProperties: false
  };

  try {
    if (!process.env.GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY is missing from environment variables');
    }

    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'openai/gpt-oss-120b',
        messages: [





          {
            role: 'system',
            content:
              'Analyse les offres d’emploi selon les règles fournies. Réponds exclusivement avec les données correspondant au JSON Schema.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.2,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'job_analysis',
            strict: true,
            schema: responseSchema
          }
        }
      },
      {
        headers: {
          Authorization: 'Bearer ' + (process.env.GROQ_API_KEY || ''),
          'Content-Type': 'application/json'
        },
        timeout: 60000
      }
    );

    const text = response.data?.choices?.[0]?.message?.content;

    if (!text) {
      throw new Error('Empty response from Groq');
    }

    const analysis = JSON.parse(text);

    analysis.match_score = parseInt(analysis.match_score, 10);

    if (
      Number.isNaN(analysis.match_score) ||
      analysis.match_score < 1 ||
      analysis.match_score > 10
    ) {
      throw new Error(`Invalid match_score: ${analysis.match_score}`);
    }

    return analysis;


  } catch (err) {
    console.error(
      'Groq error:',
      err.response?.data || err.message
    );
    return null;

  }
}

module.exports = {
  analyzeJob
};
