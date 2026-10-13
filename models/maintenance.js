const db = require('../config/db');

const CATEGORIES = [
  'Electrical',
  'Plumbing',
  'Heating & Cooling',
  'Cleaning',
  'Furniture',
  'Safety',
  'Technology',
  'Other'
];
const PRIORITIES = ['Low', 'Normal', 'High', 'Urgent'];
const STATUSES = ['Open', 'In Progress', 'Resolved'];

function escapeLike(value) {
  return value.replace(/[\\%_]/g, '\\$&');
}

async function createRequest(request, userId) {
  const result = await db.run(
    `INSERT INTO maintenance_requests
      (title, category, building, room, priority, description, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      request.title,
      request.category,
      request.building,
      request.room,
      request.priority,
      request.description,
      userId
    ]
  );
  await db.run(
    'INSERT INTO request_updates (request_id, user_id, status, note) VALUES (?, ?, ?, ?)',
    [result.lastID, userId, 'Open', 'Request submitted']
  );
  return result.lastID;
}

async function listRequests({ userId, isStaff, search = '', status = '' }) {
  const conditions = [];
  const values = [];
  if (!isStaff) {
    conditions.push('r.created_by = ?');
    values.push(userId);
  }
  if (status && STATUSES.includes(status)) {
    conditions.push('r.status = ?');
    values.push(status);
  }
  if (search) {
    const pattern = `%${escapeLike(search)}%`;
    conditions.push("(r.title LIKE ? ESCAPE '\\' OR r.building LIKE ? ESCAPE '\\' OR r.category LIKE ? ESCAPE '\\' OR r.room LIKE ? ESCAPE '\\')");
    values.push(pattern, pattern, pattern, pattern);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  return db.all(
    `SELECT r.*, u.full_name AS reporter_name
       FROM maintenance_requests r
       JOIN users u ON u.id = r.created_by
       ${where}
       ORDER BY CASE r.priority WHEN 'Urgent' THEN 0 WHEN 'High' THEN 1 WHEN 'Normal' THEN 2 ELSE 3 END,
                r.created_at DESC
       LIMIT 100`,
    values
  );
}

async function getRequest(id) {
  return db.get(
    `SELECT r.*, u.full_name AS reporter_name, a.full_name AS assignee_name
       FROM maintenance_requests r
       JOIN users u ON u.id = r.created_by
       LEFT JOIN users a ON a.id = r.assigned_to
      WHERE r.id = ?`,
    [id]
  );
}

async function getUpdates(requestId) {
  return db.all(
    `SELECT ru.*, u.full_name AS actor_name
       FROM request_updates ru JOIN users u ON u.id = ru.user_id
      WHERE ru.request_id = ? ORDER BY ru.created_at DESC, ru.id DESC`,
    [requestId]
  );
}

async function getDashboardStats(userId, isStaff) {
  const where = isStaff ? '' : 'WHERE created_by = ?';
  const params = isStaff ? [] : [userId];
  const rows = await db.all(
    `SELECT status, COUNT(*) AS count FROM maintenance_requests ${where} GROUP BY status`,
    params
  );
  const totals = { total: 0, open: 0, inProgress: 0, resolved: 0 };
  for (const row of rows) {
    totals.total += row.count;
    if (row.status === 'Open') totals.open = row.count;
    if (row.status === 'In Progress') totals.inProgress = row.count;
    if (row.status === 'Resolved') totals.resolved = row.count;
  }
  return totals;
}

async function getPulse() {
  return db.all(
    `SELECT building, category, COUNT(*) AS reports,
            MAX(CASE priority WHEN 'Urgent' THEN 4 WHEN 'High' THEN 3 WHEN 'Normal' THEN 2 ELSE 1 END) AS priority_score,
            MAX(updated_at) AS latest_report
       FROM maintenance_requests
      WHERE status != 'Resolved'
      GROUP BY building, category
     HAVING COUNT(*) >= 2
      ORDER BY priority_score DESC, reports DESC, latest_report DESC
      LIMIT 5`
  );
}

async function updateStatus(requestId, userId, status, note) {
  await db.run(
    "UPDATE maintenance_requests SET status = ?, updated_at = datetime('now') WHERE id = ?",
    [status, requestId]
  );
  await db.run(
    'INSERT INTO request_updates (request_id, user_id, status, note) VALUES (?, ?, ?, ?)',
    [requestId, userId, status, note]
  );
}

async function deleteRequest(requestId, userId) {
  const result = await db.run(
    "DELETE FROM maintenance_requests WHERE id = ? AND created_by = ? AND status = 'Open'",
    [requestId, userId]
  );
  return result.changes > 0;
}

module.exports = {
  CATEGORIES,
  PRIORITIES,
  STATUSES,
  createRequest,
  listRequests,
  getRequest,
  getUpdates,
  getDashboardStats,
  getPulse,
  updateStatus,
  deleteRequest
};
