const express = require('express');
const { query } = require('express-validator');
const router = express.Router();

const analyticsController = require('../controllers/analytics.controller');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');

// All routes require business_admin auth
router.use(auth, authorize('business_admin'));

// Dashboard summary
router.get('/summary', analyticsController.getDashboardSummary);

// Sales trend
router.get(
  '/sales',
  [query('period').optional().isIn(['day', 'week', 'month']).withMessage('Invalid period')],
  validate,
  analyticsController.getSalesTrend
);

// Top products
router.get(
  '/top-products',
  [query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be 1-50')],
  validate,
  analyticsController.getTopProducts
);

// Payment breakdown
router.get('/payments', analyticsController.getPaymentBreakdown);

// Customer insights
router.get('/customers', analyticsController.getCustomerInsights);

module.exports = router;
