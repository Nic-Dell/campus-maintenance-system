const db = require('../config/db');
const analytics = require('../models/adminAnalytics');
const PDFDocument = require('pdfkit');

const VERIFICATION_STATUSES = ['Verifying', 'Accepted', 'Rejected'];

exports.getVerifications = async (req, res) => {
  await db.ready;
  const accounts = await db.all(
    `SELECT id, full_name, email, unique_id, role, verification_status, created_at
     FROM users
     WHERE role != 'admin'
     ORDER BY CASE verification_status
       WHEN 'Pending' THEN 0
       WHEN 'Verifying' THEN 1
       WHEN 'Accepted' THEN 2
       ELSE 3
     END, created_at DESC`
  );
  return res.render('admin-verifications', { accounts });
};

exports.postVerification = async (req, res) => {
  const userId = typeof req.params.id === 'string' && /^\d+$/.test(req.params.id)
    ? Number(req.params.id)
    : 0;
  const status = typeof req.body.status === 'string' ? req.body.status : '';
  if (!userId || !VERIFICATION_STATUSES.includes(status)) {
    return res.status(400).render('error', {
      title: 'Invalid verification update',
      message: 'Choose a valid account and verification status.'
    });
  }

  await db.ready;
  const account = await db.get(
    "SELECT id, unique_id, verification_status FROM users WHERE id = ? AND role != 'admin'",
    [userId]
  );
  if (!account) {
    return res.status(404).render('error', {
      title: 'Account not found',
      message: 'That account does not exist or cannot be reviewed here.'
    });
  }
  if (status === 'Accepted' && !/^\d{4,32}$/.test(account.unique_id || '')) {
    req.session.notice = {
      type: 'danger',
      message: 'This older account has no campus ID on file. Ask the person to register again with their campus ID before accepting it.'
    };
    return res.redirect('/admin/verifications');
  }

  if (account.verification_status !== status) {
    await db.run(
      "UPDATE users SET verification_status = ? WHERE id = ? AND role != 'admin'",
      [status, userId]
    );
  }
  req.session.notice = {
    type: 'success',
    message: `Account verification status is now ${status.toLowerCase()}.`
  };
  return res.redirect('/admin/verifications');
};

exports.getAnalytics = async (req, res) => {
  const reports = await analytics.getAnalytics();
  return res.render('admin-analytics', { ...reports, currentPage: 'admin-analytics' });
};

function csvCell(value) {
  const text = value == null ? '' : String(value);
  const safeText = /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safeText.replace(/"/g, '""')}"`;
}

exports.exportCsv = async (req, res) => {
  const rows = await analytics.getReportRows();
  const columns = [
    ['Request ID', 'id'],
    ['Title', 'title'],
    ['Category', 'category'],
    ['Building', 'building'],
    ['Room', 'room'],
    ['Priority', 'priority'],
    ['Status', 'status'],
    ['Reporter', 'reporter_name'],
    ['Assigned Technician', 'technician_name'],
    ['Created At', 'created_at'],
    ['Service Target', 'due_at'],
    ['Last Updated', 'updated_at'],
    ['Rating', 'rating'],
    ['Feedback', 'feedback']
  ];
  const csv = [
    columns.map(([label]) => csvCell(label)).join(','),
    ...rows.map((row) => columns.map(([, field]) => csvCell(row[field])).join(','))
  ].join('\r\n');
  res.set({
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': 'attachment; filename="campus-care-requests.csv"',
    'Cache-Control': 'no-store'
  });
  return res.send(`\uFEFF${csv}`);
};

exports.exportPdf = async (req, res, next) => {
  const [reports, rows] = await Promise.all([
    analytics.getAnalytics(),
    analytics.getReportRows()
  ]);
  const document = new PDFDocument({ margin: 44, size: 'A4', layout: 'landscape' });
  document.on('error', next);
  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': 'attachment; filename="campus-care-analytics.pdf"',
    'Cache-Control': 'no-store'
  });
  document.pipe(res);
  document.fontSize(20).fillColor('#173b5e').text('Campus Care - Analytics Report');
  document.moveDown(0.4);
  document.fontSize(10).fillColor('#34465a')
    .text(`Generated ${new Date().toLocaleString()}`)
    .text(`Requests: ${reports.summary.total}   Open: ${reports.summary.open}   In progress: ${reports.summary.in_progress}   Resolved: ${reports.summary.resolved}`)
    .text(`User ratings: ${reports.summary.feedback_count}   Average rating: ${Number(reports.summary.average_rating).toFixed(2)} / 5`);
  document.moveDown();
  document.fontSize(13).fillColor('#173b5e').text('Requests');
  document.moveDown(0.35);

  const columns = [
    { label: 'ID', width: 30, key: 'id' },
    { label: 'Priority', width: 45, key: 'priority' },
    { label: 'Status', width: 53, key: 'status' },
    { label: 'Category', width: 58, key: 'category' },
    { label: 'Location', width: 130, key: 'building' },
    { label: 'Title', width: 150, key: 'title' },
    { label: 'Technician', width: 85, key: 'technician_name' },
    { label: 'Rating', width: 35, key: 'rating' },
    { label: 'Feedback', width: 160, key: 'feedback' }
  ];
  const startX = document.x;
  const tableWidth = columns.reduce((total, column) => total + column.width, 0);
  const rowHeight = 24;
  const drawHeader = () => {
    const y = document.y;
    document.rect(startX, y, tableWidth, 20).fill('#eaf0f5');
    document.fillColor('#173b5e').fontSize(8);
    let x = startX;
    for (const column of columns) {
      document.text(column.label, x + 3, y + 6, { width: column.width - 6, lineBreak: false });
      x += column.width;
    }
    document.y = y + 24;
  };
  drawHeader();
  document.fontSize(7).fillColor('#273747');
  for (const row of rows) {
    if (document.y + rowHeight > document.page.height - document.page.margins.bottom) {
      document.addPage();
      drawHeader();
      document.fontSize(7).fillColor('#273747');
    }
    const y = document.y;
    let x = startX;
    for (const column of columns) {
      const value = row[column.key] == null ? '-' : String(row[column.key]);
      const printableValue = value.replace(/[\r\n]+/g, ' ').replace(/[^\x20-\x7E]/g, '?');
      document.text(printableValue, x + 3, y + 5, {
        width: column.width - 6,
        height: rowHeight - 6,
        ellipsis: true,
        lineBreak: false
      });
      x += column.width;
    }
    document.moveTo(startX, y + rowHeight).lineTo(x, y + rowHeight)
      .strokeColor('#e2e7ec').lineWidth(0.4).stroke();
    document.y = y + rowHeight;
  }
  document.end();
};
