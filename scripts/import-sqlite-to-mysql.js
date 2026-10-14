require('dotenv').config();

const path = require('node:path');
const sqlite3 = require('sqlite3').verbose();

if (process.env.DB_DRIVER === 'sqlite') {
  throw new Error('Set DB_DRIVER=mysql before running the SQLite-to-MySQL import.');
}
process.env.DB_DRIVER = 'mysql';
process.env.DB_SKIP_ADMIN_SEED = '1';

const db = require('../config/db');
const sourcePath = process.env.SQLITE_IMPORT_PATH || path.join(__dirname, '..', 'data', 'campus-maintenance.sqlite');

function openSqlite(filename) {
  return new Promise((resolve, reject) => {
    const connection = new sqlite3.Database(filename, sqlite3.OPEN_READONLY, (err) => {
      if (err) return reject(err);
      resolve(connection);
    });
  });
}

function readSqlite(connection, sql) {
  return new Promise((resolve, reject) => {
    connection.all(sql, (err, rows) => err ? reject(err) : resolve(rows));
  });
}

function closeSqlite(connection) {
  return new Promise((resolve, reject) => {
    connection.close((err) => err ? reject(err) : resolve());
  });
}

async function importRows(connection, table, rows, columns) {
  const fields = columns.join(', ');
  const placeholders = columns.map(() => '?').join(', ');
  const statement = `INSERT INTO ${table} (${fields}) VALUES (${placeholders})`;
  for (const row of rows) {
    await connection.execute(statement, columns.map((column) => row[column] ?? null));
  }
}

async function main() {
  let source;
  try {
    await db.ready;
    source = await openSqlite(sourcePath);
    const [users, requests, updates] = await Promise.all([
      readSqlite(source, 'SELECT * FROM users'),
      readSqlite(source, 'SELECT * FROM maintenance_requests'),
      readSqlite(source, 'SELECT * FROM request_updates')
    ]);
    const [categoryTable] = await readSqlite(
      source,
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'technician_categories'"
    );
    const technicianCategories = categoryTable
      ? await readSqlite(source, 'SELECT user_id, category FROM technician_categories')
      : [];
    const [feedbackTable] = await readSqlite(
      source,
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'request_feedback'"
    );
    const feedback = feedbackTable
      ? await readSqlite(source, 'SELECT * FROM request_feedback')
      : [];
    const legacyUsers = users.map((user) => ({
      ...user,
      unique_id: user.unique_id || null,
      profile_image: user.profile_image || null,
      verification_status: user.verification_status ||
        (user.role === 'admin' ? 'Accepted' : 'Pending')
    }));
    const legacyRequests = requests.map((request) => ({
      ...request,
      report_image: request.report_image || null,
      before_image: request.before_image || null,
      after_image: request.after_image || null,
      due_at: request.due_at || null
    }));

    const [userCount] = await db.all('SELECT COUNT(*) AS count FROM users');
    const [requestCount] = await db.all('SELECT COUNT(*) AS count FROM maintenance_requests');
    const [updateCount] = await db.all('SELECT COUNT(*) AS count FROM request_updates');
    if (userCount.count || requestCount.count || updateCount.count) {
      throw new Error(
        `Target database "${db.databaseName}" is not empty. Import stopped without changing it; choose a new MYSQL_DATABASE or back up and empty the target first.`
      );
    }

    const connection = await require('mysql2/promise').createConnection({
      host: process.env.MYSQL_HOST || '127.0.0.1',
      port: Number(process.env.MYSQL_PORT) || 3306,
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || '',
      database: db.databaseName,
      charset: 'utf8mb4',
      dateStrings: true
    });
    try {
      await connection.beginTransaction();
      await importRows(connection, 'users', legacyUsers, [
        'id', 'full_name', 'email', 'unique_id', 'password', 'role', 'verification_status',
        'profile_image', 'created_at'
      ]);
      await importRows(connection, 'technician_categories', technicianCategories, [
        'user_id', 'category'
      ]);
      await importRows(connection, 'maintenance_requests', legacyRequests, [
        'id', 'title', 'category', 'building', 'room', 'priority', 'description', 'status',
        'created_by', 'assigned_to', 'report_image', 'before_image', 'after_image', 'due_at',
        'created_at', 'updated_at'
      ]);
      await importRows(connection, 'request_updates', updates, [
        'id', 'request_id', 'user_id', 'status', 'note', 'created_at'
      ]);
      await importRows(connection, 'request_feedback', feedback, [
        'id', 'request_id', 'user_id', 'rating', 'comment', 'created_at', 'updated_at'
      ]);
      await connection.commit();
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      await connection.end();
    }
    if (!legacyUsers.some((user) => user.role === 'admin')) await db.seedAdmin();
    console.log(
      `Imported ${legacyUsers.length} users, ${legacyRequests.length} maintenance requests, ${updates.length} request updates, and ${feedback.length} feedback records from SQLite into MySQL database "${db.databaseName}".`
    );
    console.log('The original SQLite database was left unchanged.');
  } finally {
    if (source) await closeSqlite(source);
    await db.close();
  }
}

main().catch((err) => {
  console.error('SQLite-to-MySQL import failed:', err.message);
  process.exitCode = 1;
});
