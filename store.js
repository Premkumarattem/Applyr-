// Minimal file-based, multi-user store. Good enough for a small-scale app.
// Swap this out for a real database (SQLite/Postgres) when you outgrow it.
const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'data.json');

function emptyDB() {
  return { users: {} };
}

function emptyUser() {
  return { passwordHash: '', savedJobs: [], sentEmails: [], profile: { resumeText: '' } };
}

function readDB() {
  if (!fs.existsSync(DB_FILE)) return emptyDB();
  try {
    const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
    if (!db.users) db.users = {};
    return db;
  } catch {
    return emptyDB();
  }
}

function writeDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function userExists(username) {
  const db = readDB();
  return Boolean(db.users[username]);
}

function createUser(username, passwordHash) {
  const db = readDB();
  db.users[username] = { ...emptyUser(), passwordHash };
  writeDB(db);
  return db.users[username];
}

function getUser(username) {
  const db = readDB();
  return db.users[username] || null;
}

function saveJob(username, job) {
  const db = readDB();
  const user = db.users[username];
  if (!user) return null;
  if (!user.savedJobs.find((j) => j.id === job.id)) {
    user.savedJobs.push(job);
    writeDB(db);
  }
  return user.savedJobs;
}

function getSavedJobs(username) {
  const user = readDB().users[username];
  return user ? user.savedJobs : [];
}

function logSentEmail(username, entry) {
  const db = readDB();
  const user = db.users[username];
  if (!user) return [];
  user.sentEmails.push({ ...entry, sentAt: new Date().toISOString() });
  writeDB(db);
  return user.sentEmails;
}

function getSentEmails(username) {
  const user = readDB().users[username];
  return user ? user.sentEmails : [];
}

function saveProfile(username, profile) {
  const db = readDB();
  const user = db.users[username];
  if (!user) return null;
  user.profile = { ...user.profile, ...profile };
  writeDB(db);
  return user.profile;
}

function getProfile(username) {
  const user = readDB().users[username];
  return user ? user.profile : { resumeText: '' };
}

module.exports = {
  userExists,
  createUser,
  getUser,
  saveJob,
  getSavedJobs,
  logSentEmail,
  getSentEmails,
  saveProfile,
  getProfile,
};
