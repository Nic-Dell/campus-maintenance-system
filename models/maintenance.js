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
const SLA_HOURS = { Urgent: 24, High: 72, Normal: 168, Low: 336 };

function escapeLike(value) {
  return value.replace(/[!%_]/g, '!$&');
}

async function createRequest(request, userId, reportImage = null) {
  const dueAt = new Date(Date.now() + SLA_HOURS[request.priority] * 60 * 60 * 1000)
    .toISOString()
    .replace('T', ' ')
    .slice(0, 19);
  const technician = await db.get(
    `SELECT u.id, u.full_name
       FROM users u
       JOIN technician_categories tc ON tc.user_id = u.id
       LEFT JOIN maintenance_requests active
         ON active.assigned_to = u.id AND active.status != 'Resolved'
      WHERE u.role = 'staff'
        AND u.verification_status = 'Accepted'
        AND tc.category = ?
      GROUP BY u.id, u.created_at
      ORDER BY COUNT(active.id), u.created_at, u.id
      LIMIT 1`,
    [request.category]
  );
  const result = await db.run(
    `INSERT INTO maintenance_requests
      (title, category, building, room, priority, description, created_by, assigned_to, report_image, due_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      request.title,
      request.category,
      request.building,
      request.room,
      request.priority,
      request.description,
      userId,
      technician ? technician.id : null,
      reportImage,
      dueAt
    ]
  );
  await db.run(
    'INSERT INTO request_updates (request_id, user_id, status, note) VALUES (?, ?, ?, ?)',
    [
      result.lastID,
      userId,
      'Open',
      technician
        ? `Automatically scheduled with ${technician.full_name} based on category and active workload`
        : 'Request submitted; awaiting an eligible technician'
    ]
  );
  return { id: result.lastID, assigneeName: technician ? technician.full_name : null };
}

async function listRequests({ userId, isStaff, role, categories = [], search = '', status = '' }) {
  const conditions = [];
  const values = [];
  if (role === 'staff') {
    if (categories.length) {
      conditions.push(`(
        r.assigned_to = ? OR (
          r.assigned_to IS NULL AND r.category IN (${categories.map(() => '?').join(', ')})
        )
      )`);
      values.push(userId, ...categories);
    } else {
      conditions.push('r.assigned_to = ?');
      values.push(userId);
    }
  } else if (!isStaff) {
    conditions.push('r.created_by = ?');
    values.push(userId);
  }
  if (status && STATUSES.includes(status)) {
    conditions.push('r.status = ?');
    values.push(status);
  }
  if (search) {
    const pattern = `%${escapeLike(search)}%`;
    conditions.push("(r.title LIKE ? ESCAPE '!' OR r.building LIKE ? ESCAPE '!' OR r.category LIKE ? ESCAPE '!' OR r.room LIKE ? ESCAPE '!')");
    values.push(pattern, pattern, pattern, pattern);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  return db.all(
    `SELECT r.*, u.full_name AS reporter_name,
            CASE WHEN r.status != 'Resolved' AND r.due_at <= datetime('now') THEN 1 ELSE 0 END AS is_overdue,
            CASE WHEN r.status != 'Resolved' AND r.due_at > datetime('now')
                   AND r.due_at <= datetime('now', '+24 hours') THEN 1 ELSE 0 END AS due_soon
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
    `SELECT r.*, u.full_name AS reporter_name, a.full_name AS assignee_name,
            f.rating AS feedback_rating, f.comment AS feedback_comment,
            f.updated_at AS feedback_updated_at
       FROM maintenance_requests r
       JOIN users u ON u.id = r.created_by
       LEFT JOIN users a ON a.id = r.assigned_to
       LEFT JOIN request_feedback f ON f.request_id = r.id
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

async function getSlaStats(userId, isStaff) {
  const scope = isStaff ? '' : 'AND created_by = ?';
  const params = isStaff ? [] : [userId];
  return db.get(
    `SELECT
       COALESCE(SUM(CASE WHEN due_at <= datetime('now') THEN 1 ELSE 0 END), 0) AS overdue,
       COALESCE(SUM(CASE WHEN due_at > datetime('now') AND due_at <= datetime('now', '+24 hours') THEN 1 ELSE 0 END), 0) AS due_soon
     FROM maintenance_requests
     WHERE status != 'Resolved' ${scope}`,
    params
  );
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

async function updateStatus(requestId, userId, status, note, images = {}) {
  await db.run(
    `UPDATE maintenance_requests
        SET status = ?, updated_at = datetime('now'),
            before_image = COALESCE(?, before_image),
            after_image = COALESCE(?, after_image)
      WHERE id = ?`,
    [status, images.beforeImage || null, images.afterImage || null, requestId]
  );
  await db.run(
    'INSERT INTO request_updates (request_id, user_id, status, note) VALUES (?, ?, ?, ?)',
    [requestId, userId, status, note]
  );
}

async function claimRequest(requestId, userId, category, actorName) {
  const result = await db.run(
    `UPDATE maintenance_requests
        SET assigned_to = ?, updated_at = datetime('now')
      WHERE id = ? AND assigned_to IS NULL AND status = 'Open' AND category = ?
        AND EXISTS (
          SELECT 1 FROM technician_categories
           WHERE user_id = ? AND category = ?
        )`,
    [userId, requestId, category, userId, category]
  );
  if (!result.changes) return false;
  await db.run(
    'INSERT INTO request_updates (request_id, user_id, status, note) VALUES (?, ?, ?, ?)',
    [requestId, userId, 'Open', `Accepted by ${actorName}`]
  );
  return true;
}

async function saveFeedback(requestId, userId, rating, comment) {
  if (db.driver === 'mysql') {
    await db.run(
      `INSERT INTO request_feedback (request_id, user_id, rating, comment)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), rating = VALUES(rating),
         comment = VALUES(comment), updated_at = datetime('now')`,
      [requestId, userId, rating, comment]
    );
    return;
  }
  await db.run(
    `INSERT INTO request_feedback (request_id, user_id, rating, comment)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(request_id) DO UPDATE SET
       user_id = excluded.user_id, rating = excluded.rating,
       comment = excluded.comment, updated_at = datetime('now')`,
    [requestId, userId, rating, comment]
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
  SLA_HOURS,
  STATUSES,
  createRequest,
  listRequests,
  getRequest,
  getUpdates,
  getDashboardStats,
  getSlaStats,
  getPulse,
  updateStatus,
  claimRequest,
  saveFeedback,
  deleteRequest
};
