const express = require('express');
const maintenanceController = require('../controllers/maintenanceController');
const { isLoggedIn, hasRole } = require('../middleware/auth');

const router = express.Router();

router.get('/dashboard', isLoggedIn, maintenanceController.getDashboard);
router.get('/requests/new', isLoggedIn, maintenanceController.getNewRequest);
router.post('/requests', isLoggedIn, maintenanceController.postRequest);
router.get('/requests/:id', isLoggedIn, maintenanceController.getRequest);
router.post('/requests/:id/status', hasRole(['staff', 'admin']), maintenanceController.postStatus);
router.post('/requests/:id/delete', isLoggedIn, maintenanceController.postDelete);

module.exports = router;
