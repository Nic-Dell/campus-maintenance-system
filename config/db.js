const fs = require('node:fs');
const path = require('node:path');
const bcrypt = require('bcrypt');

const driver = (process.env.DB_DRIVER || 'mysql').toLowerCase();
if (!['mysql', 'sqlite'].includes(driver)) {
  throw new Error('DB_DRIVER must be either mysql or sqlite.');
}

const databasePath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'campus-maintenance.sqlite');
const sqliteDatabaseName = path.basename(databasePath, path.extname(databasePath));
const databaseName = driver === 'mysql'
  ? process.env.MYSQL_DATABASE || 'campus_maintenance'
  : sqliteDatabaseName;
const uploadsDirectory = process.env.UPLOADS_PATH ||
  path.join(path.dirname(databasePath), `${sqliteDatabaseName}-uploads`);
fs.mkdirSync(path.dirname(databasePath), { recursive: true });

let sqliteConnection;
let mysqlPool;

function normalizeSql(sql) {
  return sql
    .replace(/datetime\('now'\s*,\s*'([+-])(\d+)\s+hours?'\)/gi, (_, sign, hours) => {
      const interval = sign === '-' ? -Number(hours) : Number(hours);
      return `DATE_ADD(UTC_TIMESTAMP(), INTERVAL ${interval} HOUR)`;
    })
    .replace(/datetime\('now'\)/gi, 'UTC_TIMESTAMP()');
}

const run = async (sql, params = []) => {
  if (driver === 'sqlite') {
    return new Promise((resolve, reject) => {
      sqliteConnection.run(sql, params, function onRun(err) {
        if (err) return reject(err);
        resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }
  const [result] = await mysqlPool.execute(normalizeSql(sql), params);
  return { lastID: result.insertId, changes: result.affectedRows };
};

const get = async (sql, params = []) => {
  if (driver === 'sqlite') {
    return new Promise((resolve, reject) => {
      sqliteConnection.get(sql, params, (err, row) => {
        if (err) return reject(err);
        resolve(row);
      });
    });
  }
  const [rows] = await mysqlPool.execute(normalizeSql(sql), params);
  return rows[0];
};

const all = async (sql, params = []) => {
  if (driver === 'sqlite') {
    return new Promise((resolve, reject) => {
      sqliteConnection.all(sql, params, (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  }
  const [rows] = await mysqlPool.execute(normalizeSql(sql), params);
  return rows;
};

async function initializeMysql() {
  const configuredName = process.env.MYSQL_DATABASE || 'campus_maintenance';
  if (!/^[A-Za-z0-9_]+$/.test(configuredName)) {
    throw new Error('MYSQL_DATABASE may contain only letters, numbers, and underscores.');
  }

  const mysql = require('mysql2/promise');
  const host = process.env.MYSQL_HOST || '127.0.0.1';
  const port = Number(process.env.MYSQL_PORT) || 3306;
  const user = process.env.MYSQL_USER || 'root';
  const password = process.env.MYSQL_PASSWORD || '';
  const server = await mysql.createConnection({ host, port, user, password });
  try {
    await server.query(
      `CREATE DATABASE IF NOT EXISTS \`${configuredName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
  } finally {
    await server.end();
  }

  mysqlPool = mysql.createPool({
    host,
    port,
    user,
    password,
    database: configuredName,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: 'utf8mb4',
    dateStrings: true
  });

  const tableDefinitions = [
    `CREATE TABLE IF NOT EXISTS users (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      full_name VARCHAR(80) NOT NULL,
      email VARCHAR(254) NOT NULL,
      unique_id VARCHAR(32) NULL,
      password VARCHAR(255) NOT NULL,
      role VARCHAR(16) NOT NULL,
      verification_status VARCHAR(16) NOT NULL DEFAULT 'Pending',
      profile_image VARCHAR(80) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_users_email (email),
      UNIQUE KEY uq_users_unique_id (unique_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS maintenance_requests (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(100) NOT NULL,
      category VARCHAR(40) NOT NULL,
      building VARCHAR(80) NOT NULL,
      room VARCHAR(40) NOT NULL DEFAULT '',
      priority VARCHAR(16) NOT NULL,
      description VARCHAR(2000) NOT NULL,
      status VARCHAR(16) NOT NULL DEFAULT 'Open',
      created_by INT UNSIGNED NOT NULL,
      assigned_to INT UNSIGNED NULL,
      report_image VARCHAR(80) NULL,
      before_image VARCHAR(80) NULL,
      after_image VARCHAR(80) NULL,
      due_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_requests_status_location (status, building, category),
      KEY idx_requests_creator (created_by, created_at),
      KEY idx_requests_sla (status, due_at),
      CONSTRAINT fk_requests_creator FOREIGN KEY (created_by) REFERENCES users(id),
      CONSTRAINT fk_requests_assignee FOREIGN KEY (assigned_to) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS request_updates (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      request_id INT UNSIGNED NOT NULL,
      user_id INT UNSIGNED NOT NULL,
      status VARCHAR(16) NOT NULL,
      note VARCHAR(240) NOT NULL DEFAULT '',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_updates_request_time (request_id, created_at, id),
      CONSTRAINT fk_updates_request FOREIGN KEY (request_id)
        REFERENCES maintenance_requests(id) ON DELETE CASCADE,
      CONSTRAINT fk_updates_user FOREIGN KEY (user_id) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS technician_categories (
      user_id INT UNSIGNED NOT NULL,
      category VARCHAR(40) NOT NULL,
      PRIMARY KEY (user_id, category),
      CONSTRAINT fk_technician_categories_user FOREIGN KEY (user_id)
        REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS request_feedback (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      request_id INT UNSIGNED NOT NULL,
      user_id INT UNSIGNED NOT NULL,
      rating TINYINT UNSIGNED NOT NULL,
      comment VARCHAR(1000) NOT NULL DEFAULT '',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_feedback_request (request_id),
      CONSTRAINT fk_feedback_request FOREIGN KEY (request_id)
        REFERENCES maintenance_requests(id) ON DELETE CASCADE,
      CONSTRAINT fk_feedback_user FOREIGN KEY (user_id) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  ];
  for (const definition of tableDefinitions) await mysqlPool.query(definition);

  await migrateMysql();
}

async function migrateMysql() {
  const [userColumns] = await mysqlPool.query('SHOW COLUMNS FROM users');
  const userColumnNames = new Set(userColumns.map((column) => column.Field));
  if (!userColumnNames.has('unique_id')) {
    await mysqlPool.query('ALTER TABLE users ADD COLUMN unique_id VARCHAR(32) NULL');
    await mysqlPool.query('ALTER TABLE users ADD UNIQUE KEY uq_users_unique_id (unique_id)');
  }
  if (!userColumnNames.has('verification_status')) {
    await mysqlPool.query(
      "ALTER TABLE users ADD COLUMN verification_status VARCHAR(16) NOT NULL DEFAULT 'Pending'"
    );
  }
  if (!userColumnNames.has('profile_image')) {
    await mysqlPool.query('ALTER TABLE users ADD COLUMN profile_image VARCHAR(80) NULL');
  }
  await mysqlPool.query(`CREATE TABLE IF NOT EXISTS technician_categories (
    user_id INT UNSIGNED NOT NULL,
    category VARCHAR(40) NOT NULL,
    PRIMARY KEY (user_id, category),
    CONSTRAINT fk_technician_categories_user FOREIGN KEY (user_id)
      REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await mysqlPool.query(`CREATE TABLE IF NOT EXISTS request_feedback (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    request_id INT UNSIGNED NOT NULL,
    user_id INT UNSIGNED NOT NULL,
    rating TINYINT UNSIGNED NOT NULL,
    comment VARCHAR(1000) NOT NULL DEFAULT '',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_feedback_request (request_id),
    CONSTRAINT fk_feedback_request FOREIGN KEY (request_id)
      REFERENCES maintenance_requests(id) ON DELETE CASCADE,
    CONSTRAINT fk_feedback_user FOREIGN KEY (user_id) REFERENCES users(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await mysqlPool.query("UPDATE users SET verification_status = 'Accepted' WHERE role = 'admin'");
  await mysqlPool.query(
    "UPDATE users SET verification_status = 'Accepted' WHERE role IN ('student', 'faculty')"
  );

  const [requestColumns] = await mysqlPool.query('SHOW COLUMNS FROM maintenance_requests');
  const requestColumnNames = new Set(requestColumns.map((column) => column.Field));
  for (const column of ['report_image', 'before_image', 'after_image']) {
    if (!requestColumnNames.has(column)) {
      await mysqlPool.query(`ALTER TABLE maintenance_requests ADD COLUMN ${column} VARCHAR(80) NULL`);
    }
  }
  if (!requestColumnNames.has('due_at')) {
    await mysqlPool.query('ALTER TABLE maintenance_requests ADD COLUMN due_at DATETIME NULL');
  }
  await mysqlPool.query(`
    UPDATE maintenance_requests
       SET due_at = DATE_ADD(created_at, INTERVAL
         CASE priority
           WHEN 'Urgent' THEN 24
           WHEN 'High' THEN 72
           WHEN 'Normal' THEN 168
           ELSE 336
         END HOUR)
     WHERE due_at IS NULL
  `);
}

async function initializeSqlite() {
  const sqlite3 = require('sqlite3').verbose();
  sqliteConnection = new sqlite3.Database(databasePath);
  await new Promise((resolve, reject) => {
    sqliteConnection.exec(`
      PRAGMA foreign_keys = ON;
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        full_name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE COLLATE NOCASE,
        unique_id TEXT,
        password TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('student', 'faculty', 'staff', 'admin')),
        verification_status TEXT NOT NULL DEFAULT 'Pending'
          CHECK (verification_status IN ('Pending', 'Verifying', 'Accepted', 'Rejected')),
        profile_image TEXT,
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
        report_image TEXT,
        before_image TEXT,
        after_image TEXT,
        due_at TEXT,
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
      CREATE TABLE IF NOT EXISTS technician_categories (
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        category TEXT NOT NULL,
        PRIMARY KEY (user_id, category)
      );
      CREATE TABLE IF NOT EXISTS request_feedback (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        request_id INTEGER NOT NULL UNIQUE REFERENCES maintenance_requests(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id),
        rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
        comment TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_requests_status_location
        ON maintenance_requests(status, building, category);
      CREATE INDEX IF NOT EXISTS idx_requests_creator
        ON maintenance_requests(created_by, created_at);
    `, (err) => err ? reject(err) : resolve());
  });
  await migrateSqlite();
}

async function migrateSqlite() {
  const userColumns = await all('PRAGMA table_info(users)');
  const userColumnNames = new Set(userColumns.map((column) => column.name));
  if (!userColumnNames.has('unique_id')) await run('ALTER TABLE users ADD COLUMN unique_id TEXT');
  if (!userColumnNames.has('verification_status')) {
    await run(`ALTER TABLE users ADD COLUMN verification_status TEXT NOT NULL DEFAULT 'Pending'
      CHECK (verification_status IN ('Pending', 'Verifying', 'Accepted', 'Rejected'))`);
  }
  if (!userColumnNames.has('profile_image')) {
    await run('ALTER TABLE users ADD COLUMN profile_image TEXT');
  }
  await run(`CREATE TABLE IF NOT EXISTS technician_categories (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    PRIMARY KEY (user_id, category)
  )`);
  await run('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_unique_id ON users(unique_id)');
  await run("UPDATE users SET verification_status = 'Accepted' WHERE role = 'admin'");
  await run(
    "UPDATE users SET verification_status = 'Accepted' WHERE role IN ('student', 'faculty')"
  );

  const requestColumns = await all('PRAGMA table_info(maintenance_requests)');
  const requestColumnNames = new Set(requestColumns.map((column) => column.name));
  for (const column of ['report_image', 'before_image', 'after_image', 'due_at']) {
    if (!requestColumnNames.has(column)) {
      await run(`ALTER TABLE maintenance_requests ADD COLUMN ${column} TEXT`);
    }
  }
  await run(`UPDATE maintenance_requests
    SET due_at = datetime(created_at, CASE priority
      WHEN 'Urgent' THEN '+24 hours'
      WHEN 'High' THEN '+72 hours'
      WHEN 'Normal' THEN '+168 hours'
      ELSE '+336 hours'
    END)
    WHERE due_at IS NULL`);
  await run('CREATE INDEX IF NOT EXISTS idx_requests_sla ON maintenance_requests(status, due_at)');
}

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL && process.env.ADMIN_EMAIL.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email && !password) return ensureAdminIds();
  if (!email) throw new Error('Set ADMIN_EMAIL when configuring an administrator account.');

  const existing = await get('SELECT id, unique_id, role FROM users WHERE email = ?', [email]);
  if (existing) {
    if (existing.role !== 'admin') {
      throw new Error('ADMIN_EMAIL already belongs to a non-administrator account. Choose a separate administrator email.');
    }
    if (existing.unique_id) return ensureAdminIds();
    const uniqueId = process.env.ADMIN_UNIQUE_ID && process.env.ADMIN_UNIQUE_ID.trim();
    if (!uniqueId || !/^\d{4,32}$/.test(uniqueId)) {
      throw new Error('Set ADMIN_UNIQUE_ID to the existing administrator’s 4-32 digit campus ID to finish database migration.');
    }
    await run('UPDATE users SET unique_id = ? WHERE id = ?', [uniqueId, existing.id]);
    return ensureAdminIds();
  }
  if (!password || password.length < 12) {
    throw new Error('Set an ADMIN_PASSWORD of at least 12 characters to bootstrap an administrator.');
  }
  const uniqueId = process.env.ADMIN_UNIQUE_ID && process.env.ADMIN_UNIQUE_ID.trim();
  if (!uniqueId || !/^\d{4,32}$/.test(uniqueId)) {
    throw new Error('Set ADMIN_UNIQUE_ID to the administrator’s 4-32 digit campus ID to bootstrap an administrator.');
  }
  const hash = await bcrypt.hash(password, 12);
  await run(
    'INSERT INTO users (full_name, email, unique_id, password, role, verification_status) VALUES (?, ?, ?, ?, ?, ?)',
    [process.env.ADMIN_NAME || 'Campus Administrator', email, uniqueId, hash, 'admin', 'Accepted']
  );
  console.log(`Bootstrapped administrator account: ${email}`);
  await ensureAdminIds();
}

async function ensureAdminIds() {
  const missingAdminId = await get("SELECT id FROM users WHERE role = 'admin' AND unique_id IS NULL LIMIT 1");
  if (missingAdminId) {
    throw new Error('An administrator is missing a campus ID. Set ADMIN_EMAIL and ADMIN_UNIQUE_ID for each existing administrator in .env.');
  }
}

const ready = (async () => {
  if (driver === 'mysql') await initializeMysql();
  else await initializeSqlite();
  if (process.env.DB_SKIP_ADMIN_SEED !== '1') await seedAdmin();
})();

async function close() {
  await ready;
  if (driver === 'sqlite') {
    await new Promise((resolve, reject) => {
      sqliteConnection.close((err) => err ? reject(err) : resolve());
    });
    return;
  }
  await mysqlPool.end();
}

module.exports = {
  all,
  get,
  run,
  ready,
  close,
  driver,
  seedAdmin,
  databasePath,
  databaseName,
  uploadsDirectory
};
