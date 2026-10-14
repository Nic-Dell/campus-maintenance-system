const express = require('express');
const profileController = require('../controllers/profileController');
const { isLoggedIn } = require('../middleware/auth');
const { parseProfileImage } = require('../middleware/imageUploads');

const router = express.Router();

router.get('/profile', isLoggedIn, profileController.getProfile);
router.post('/profile', isLoggedIn, parseProfileImage, profileController.postProfile);
router.get('/profile/image', isLoggedIn, profileController.getProfileImage);

module.exports = router;
