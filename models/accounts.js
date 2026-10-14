const db = require('../config/db');

async function getTechnicianCategories(userId) {
  const rows = await db.all(
    'SELECT category FROM technician_categories WHERE user_id = ? ORDER BY category',
    [userId]
  );
  return rows.map((row) => row.category);
}

async function setTechnicianCategories(userId, categories) {
  await db.run('DELETE FROM technician_categories WHERE user_id = ?', [userId]);
  for (const category of categories) {
    await db.run(
      'INSERT INTO technician_categories (user_id, category) VALUES (?, ?)',
      [userId, category]
    );
  }
}

module.exports = { getTechnicianCategories, setTechnicianCategories };
