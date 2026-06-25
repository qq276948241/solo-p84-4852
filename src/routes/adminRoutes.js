const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { auth, authAdmin } = require('../middleware/auth');

router.get('/today', auth(), authAdmin, adminController.getTodayStats);

router.get('/status', auth(), authAdmin, adminController.getStatusStats);

router.get('/range', auth(), authAdmin, adminController.getRangeStats);

router.get('/duration', auth(), authAdmin, adminController.getAvgDurationStats);

module.exports = router;
