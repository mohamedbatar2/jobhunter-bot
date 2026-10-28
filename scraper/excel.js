const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const EXCEL_FILE_PATH = path.join(__dirname, 'jobs_classified.xlsx');

/**
 * Appends a job and its AI classification to an Excel spreadsheet.
 * @param {Object} job - Raw scraped job object
 * @param {Object} analysis - AI classification output from groq.js
 */
function appendToExcel(job, analysis) {
  try {
    let workbook;
    let worksheet;
    let data = [];

    const dateStr = new Date().toLocaleString('fr-FR', { timeZone: 'Africa/Casablanca' });
    const fiche = analysis.fiche || {};
    const draft = analysis.draft_email || {};

    const newRow = {
      'Date': dateStr,
      'ID': job.id || '',
      'Poste': fiche.poste || job.title || '',
      'Entreprise': fiche.entreprise || job.company || '',
      'Localisation': fiche.localisation || job.location || '',
      'Source': job.source || '',
      'Filière': analysis.career_track || analysis.classification?.domaine || 'Autre',
      'Cible': analysis.target_type || 'opportunistic',
      'Match Score': analysis.match_score || 0,
      'CV Recommandé': analysis.cv_recommande || 'cv_general',
      'Raison du Match': analysis.match_reason || '',
      'Type Contrat': fiche.type_contrat || '',
      'Salaire': fiche.salaire || 'Non précisé',
      'Compétences Requises': Array.isArray(fiche.competences_requises) ? fiche.competences_requises.join(', ') : '',
      'Points Forts': Array.isArray(fiche.points_forts) ? fiche.points_forts.join(', ') : '',
      'Gaps / Manques': Array.isArray(analysis.gaps) ? analysis.gaps.join(', ') : '',
      'Remote': analysis.remote ? 'Oui' : 'Non',
      'Langue Requise': fiche.langue_requise || '',
      'Objet Email': draft.objet || '',
      'Corps Email': draft.corps || '',
      'URL Offre': job.url || ''
    };

    if (fs.existsSync(EXCEL_FILE_PATH)) {
      workbook = XLSX.readFile(EXCEL_FILE_PATH);
      const sheetName = workbook.SheetNames[0] || 'Offres_Emploi';
      worksheet = workbook.Sheets[sheetName];
      data = XLSX.utils.sheet_to_json(worksheet);
    } else {
      workbook = XLSX.utils.book_new();
    }

    data.push(newRow);

    const newWorksheet = XLSX.utils.json_to_sheet(data, {
      header: [
        'Date', 'ID', 'Poste', 'Entreprise', 'Localisation', 'Source',
        'Filière', 'Cible',
        'Match Score', 'CV Recommandé', 'Raison du Match', 'Type Contrat',
        'Salaire', 'Compétences Requises', 'Points Forts', 'Gaps / Manques',
        'Remote', 'Langue Requise', 'Objet Email', 'Corps Email', 'URL Offre'
      ]
    });

    // Auto column width adjustment
    const colWidths = Object.keys(newRow).map(key => ({
      wch: Math.min(Math.max(key.length, 12), 50)
    }));
    newWorksheet['!cols'] = colWidths;

    if (workbook.SheetNames.length === 0) {
      XLSX.utils.book_append_sheet(workbook, newWorksheet, 'Offres_Emploi');
    } else {
      workbook.Sheets[workbook.SheetNames[0]] = newWorksheet;
    }

    XLSX.writeFile(workbook, EXCEL_FILE_PATH);
    console.log(`[Excel] Appended offer: "${newRow.Poste}" at ${EXCEL_FILE_PATH}`);
  } catch (err) {
    console.error('[Excel] Error appending offer to Excel:', err.message);
  }
}


function getAllJobs() {
  if (!fs.existsSync(EXCEL_FILE_PATH)) return [];
  const workbook = XLSX.readFile(EXCEL_FILE_PATH);
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });
  const skillsKey = 'Comp' + String.fromCharCode(0x00E9) + 'tences Requises';
  return rows.map(row => ({
    id: String(row.ID || ''),
    title: String(row.Poste || ''),
    company: String(row.Entreprise || ''),
    location: String(row.Localisation || ''),
    source: String(row.Source || ''),
    url: String(row['URL Offre'] || ''),
    description: [
      row['Type Contrat'] && `Saved contract type: ${row['Type Contrat']}`,
      row[skillsKey] && `Saved required skills: ${row[skillsKey]}`,
      row['Points Forts'] && `Previously noted strengths: ${row['Points Forts']}`,
      row['Gaps / Manques'] && `Previously noted gaps: ${row['Gaps / Manques']}`,
      row['Raison du Match'] && `Previous assessment notes: ${row['Raison du Match']}`
    ].filter(Boolean).join('\n')
  })).filter(job => job.title && job.company);
}

function getRecentJobs(limit = 10) {
  return getAllJobs().slice(0, limit);
}
module.exports = { appendToExcel, getRecentJobs, getAllJobs, EXCEL_FILE_PATH };
