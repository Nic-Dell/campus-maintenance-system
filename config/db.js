const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');

const databasePath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'campus-maintenance.sqlite');
fs.mkdirSync(path.dirname(databasePath), { recursive: true });

const connection = new sqlite3.Database(databasePath);

const run = (sql, params = []) => new Promise((resolve, reject) => {
  connection.run(sql, params, function onRun(err) {
    if (err) return reject(err);
    resolve({ lastID: this.lastID, changes: this.changes });
  });
});

const get = (sql, params = []) => new Promise((resolve, reject) => {
  connection.get(sql, params, (err, row) => {
    if (err) return reject(err);
    resolve(row);
  });
});

const all = (sql, params = []) => new Promise((resolve, reject) => {
  connection.all(sql, params, (err, rows) => {
    if (err) return reject(err);
    resolve(rows);
  });
});

const ready = new Promise((resolve, reject) => {
  connection.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('student', 'faculty', 'staff', 'admin')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS maintenance_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      building TEXT NOT NULL,
      room TEXT NOT NULL DEFAULT '',
      priority TEXT NOT NULL CHECK (priority IN ('Low', 'Normal', 'High', 'Urgent')),
      description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'In Progress', 'Resolved')),
      created_by INTEGER NOT NULL REFERENCES users(id),
      assigned_to INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS request_updates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_id INTEGER NOT NULL REFERENCES maintenance_requests(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id),
      status TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_requests_status_location
      ON maintenance_requests(status, building, category);
    CREATE INDEX IF NOT EXISTS idx_requests_creator
      ON maintenance_requests(created_by, created_at);
  `, async (err) => {
    if (err) return reject(err);
    try {
      await seedAdmin();
      resolve();
    } catch (seedError) {
      reject(seedError);
    }
  });
});

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL && process.env.ADMIN_EMAIL.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email && !password) return;
  if (!email || !password || password.length < 12) {
    throw new Error('Set both ADMIN_EMAIL and an ADMIN_PASSWORD of at least 12 characters to bootstrap an administrator.');
  }

  const existing = await get('SELECT id FROM users WHERE email = ?', [email]);
  if (existing) return;
  const hash = await bcrypt.hash(password, 12);
  await run(
    'INSERT INTO users (full_name, email, password, role) VALUES (?, ?, ?, ?)',
    [process.env.ADMIN_NAME || 'Campus Administrator', email, hash, 'admin']
  );
  console.log(`Bootstrapped administrator account: ${email}`);
}

const close = () => new Promise((resolve, reject) => {
  connection.close((err) => err ? reject(err) : resolve());
});

module.exports = { all, get, run, ready, close, databasePath };