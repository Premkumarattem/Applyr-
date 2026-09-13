// Minimal file-based, multi-user store with in-memory caching for reliability.
const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'data.json');
let memoryDB = null;

function emptyDB() {
  return { users: {} };
}

function emptyUser() {
  return { passwordHash: '', savedJobs: [], sentEmails: [], profile: { resumeText: '' } };
}

function readDB() {
  if (memoryDB) return memoryDB;

  if (!fs.existsSync(DB_FILE)) {
    memoryDB = emptyDB();
    writeDB(memoryDB);
    return memoryDB;
  }

  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    if (!raw.trim()) {
      memoryDB = emptyDB();
    } else {
      const parsed = JSON.parse(raw);
      if (!parsed.users) parsed.users = {};
      memoryDB = parsed;
    }
  } catch (err) {
    console.error('Error reading data.json, falling back to memory state:', err.message);
    if (!memoryDB) memoryDB = emptyDB();
  }

  return memoryDB;
}

function writeDB(db) {
  memoryDB = db;
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing data.json:', err.message);
  }
}

function userExists(username) {
  const db = readDB();
  const clean = String(username || '').trim().toLowerCase();
  return Boolean(db.users[clean]);
}

function createUser(username, passwordHash) {
  const db = readDB();
  const clean = String(username || '').trim().toLowerCase();
  db.users[clean] = { ...emptyUser(), passwordHash };
  writeDB(db);
  return db.users[clean];
}

function getUser(username) {
  const db = readDB();
  const clean = String(username || '').trim().toLowerCase();
  return db.users[clean] || null;
}

function updatePassword(username, newPasswordHash) {
  const db = readDB();
  const clean = String(username || '').trim().toLowerCase();
  const user = db.users[clean];
  if (!user) return false;
  user.passwordHash = newPasswordHash;
  writeDB(db);
  return true;
}

function saveJob(username, job) {
  const db = readDB();
  const clean = String(username || '').trim().toLowerCase();
  const user = db.users[clean];
  if (!user) return null;
  if (!Array.isArray(user.savedJobs)) user.savedJobs = [];
  if (!user.savedJobs.find((j) => j.id === job.id)) {
    user.savedJobs.push(job);
    writeDB(db);
  }
  return user.savedJobs;
}

function getSavedJobs(username) {
  const clean = String(username || '').trim().toLowerCase();
  const user = readDB().users[clean];
  return user ? (user.savedJobs || []) : [];
}

function logSentEmail(username, entry) {
  const db = readDB();
  const clean = String(username || '').trim().toLowerCase();
  const user = db.users[clean];
  if (!user) return [];
  if (!Array.isArray(user.sentEmails)) user.sentEmails = [];
  user.sentEmails.push({ ...entry, sentAt: new Date().toISOString() });
  writeDB(db);
  return user.sentEmails;
}

function getSentEmails(username) {
  const clean = String(username || '').trim().toLowerCase();
  const user = readDB().users[clean];
  return user ? (user.sentEmails || []) : [];
}

function saveProfile(username, profile) {
  const db = readDB();
  const clean = String(username || '').trim().toLowerCase();
  const user = db.users[clean];
  if (!user) return null;
  if (!user.profile) user.profile = { resumeText: '' };
  user.profile = { ...user.profile, ...profile };
  writeDB(db);
  return user.profile;
}

function getProfile(username) {
  const clean = String(username || '').trim().toLowerCase();
  const user = readDB().users[clean];
  return user ? (user.profile || { resumeText: '' }) : { resumeText: '' };
}

module.exports = {
  userExists,
  createUser,
  getUser,
  updatePassword,
  saveJob,
  getSavedJobs,
  logSentEmail,
  getSentEmails,
  saveProfile,
  getProfile,
};
