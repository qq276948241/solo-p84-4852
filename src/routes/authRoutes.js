const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { auth } = require('../middleware/auth');

router.post('/send-code', authController.sendVerifyCode);

router.post('/login', authController.login);

router.get('/me', auth(), authController.getCurrentUser);

module.exports = router;
