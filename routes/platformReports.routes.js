const express = require('express');
const router = express.Router();

const platformReportsController = require('../controllers/platformReports.controller');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');

// All routes require super_admin auth
router.use(auth, authorize('super_admin'));

// Growth stats
router.get('/growth', platformReportsController.getGrowthStats);

// Top stores
router.get('/top-stores', platformReportsController.getTopStores);

// Export report
router.get('/export', platformReportsController.exportReport);

module.exports = router;
