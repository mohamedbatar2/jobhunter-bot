const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'jobs.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    title TEXT,
    company TEXT,
    url TEXT,
    source TEXT,
    seen_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

function isNew(jobId) {
  const row = db.prepare('SELECT id FROM jobs WHERE id = ?').get(jobId);
  return !row;
}

function markSeen(job) {
  db.prepare(`
    INSERT OR IGNORE INTO jobs (id, title, company, url, source)
    VALUES (?, ?, ?, ?, ?)
  `).run(job.id, job.title, job.company, job.url, job.source);
}

module.exports = { isNew, markSeen };