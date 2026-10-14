const db = require('../config/db');

async function getAnalytics() {
  const summary = await db.get(`
    SELECT COUNT(*) AS total,
           COALESCE(SUM(status = 'Open'), 0) AS open,
           COALESCE(SUM(status = 'In Progress'), 0) AS in_progress,
           COALESCE(SUM(status = 'Resolved'), 0) AS resolved,
           (SELECT COUNT(*) FROM request_feedback) AS feedback_count,
           (SELECT COALESCE(AVG(rating), 0) FROM request_feedback) AS average_rating
      FROM maintenance_requests
  `);
  const priorities = await db.all(`
    SELECT priority, COUNT(*) AS count
      FROM maintenance_requests
     GROUP BY priority
     ORDER BY CASE priority WHEN 'Urgent' THEN 0 WHEN 'High' THEN 1
                            WHEN 'Normal' THEN 2 ELSE 3 END
  `);
  const categories = await db.all(`
    SELECT category, COUNT(*) AS count,
           COALESCE(AVG(f.rating), 0) AS average_rating
      FROM maintenance_requests r
      LEFT JOIN request_feedback f ON f.request_id = r.id
     GROUP BY category
     ORDER BY count DESC, category
  `);
  const locations = await db.all(`
    SELECT building, COUNT(*) AS count,
           COALESCE(SUM(status != 'Resolved'), 0) AS unresolved
      FROM maintenance_requests
     GROUP BY building
     ORDER BY count DESC, building
     LIMIT 10
  `);
  return { summary, priorities, categories, locations };
}

async function getReportRows() {
  return db.all(`
    SELECT r.id, r.title, r.category, r.building, r.room, r.priority, r.status,
           r.created_at, r.due_at, r.updated_at,
           reporter.full_name AS reporter_name,
           technician.full_name AS technician_name,
           f.rating, f.comment AS feedback
      FROM maintenance_requests r
      JOIN users reporter ON reporter.id = r.created_by
      LEFT JOIN users technician ON technician.id = r.assigned_to
      LEFT JOIN request_feedback f ON f.request_id = r.id
     ORDER BY CASE r.priority WHEN 'Urgent' THEN 0 WHEN 'High' THEN 1
                              WHEN 'Normal' THEN 2 ELSE 3 END,
              r.created_at DESC, r.id DESC
  `);
}

module.exports = { getAnalytics, getReportRows };
