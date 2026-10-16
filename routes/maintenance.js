const express = require('express');
const maintenanceController = require('../controllers/maintenanceController');
const { isLoggedIn, hasRole } = require('../middleware/auth');
const { parseRequestImages, parseStatusImages } = require('../middleware/imageUploads');

const router = express.Router();

router.get('/dashboard', isLoggedIn, maintenanceController.getDashboard);
router.get('/requests/new', hasRole(['student', 'faculty']), maintenanceController.getNewRequest);
router.post('/requests', hasRole(['student', 'faculty']), parseRequestImages, maintenanceController.postRequest);
router.get('/requests/:id', isLoggedIn, maintenanceController.getRequest);
router.get('/requests/:id/images/:type', isLoggedIn, maintenanceController.getRequestImage);
router.post('/requests/:id/status', hasRole(['staff']), parseStatusImages, maintenanceController.postStatus);
router.post('/requests/:id/accept', hasRole(['staff']), maintenanceController.postAcceptRequest);
router.post('/requests/:id/feedback', hasRole(['student', 'faculty']), maintenanceController.postFeedback);
router.post('/requests/:id/delete', isLoggedIn, maintenanceController.postDelete);

module.exports = router;
