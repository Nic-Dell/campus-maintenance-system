const express = require('express');
const adminController = require('../controllers/adminController');
const { hasRole } = require('../middleware/auth');

const router = express.Router();
const administratorOnly = hasRole(['admin']);

router.get('/admin/verifications', administratorOnly, adminController.getVerifications);
router.post('/admin/verifications/:id', administratorOnly, adminController.postVerification);
router.get('/admin/analytics', administratorOnly, adminController.getAnalytics);
router.get('/admin/analytics/export.csv', administratorOnly, adminController.exportCsv);
router.get('/admin/analytics/export.pdf', administratorOnly, adminController.exportPdf);

module.exports = router;
