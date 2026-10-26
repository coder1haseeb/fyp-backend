const express = require('express');
const { param, body, query } = require('express-validator');
const router = express.Router();

const adminController = require('../controllers/admin.controller');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const recommendationTraining = require('../utils/recommendationTraining');
const adminRecommendation = require('../controllers/adminRecommendation.controller');

// All routes require super_admin auth
router.use(auth, authorize('super_admin'));

// Dashboard
router.get('/dashboard', adminController.getDashboard);
router.get('/recommendations/training', (req, res) => res.json({ success: true, data: recommendationTraining.status() }));
router.get('/recommendations/insights', [
  query('page').optional().isInt({ min: 1 }),
  query('view').optional().isIn(['all', 'eligible', 'pending']),
  query('requestId').optional().isString().isLength({ min: 1, max: 100 }),
], validate, adminRecommendation.getInsights);
router.post('/recommendations/train', (req, res) => {
  const result = recommendationTraining.start();
  return res.status(result.started ? 202 : 409).json({ success: result.started, data: result.status,
    message: result.started ? 'Recommendation training started.' : 'Recommendation training is already running.' });
});

// Business management
router.get(
  '/businesses',
  [
    query('approvalStatus').optional().isIn(['pending', 'approved', 'rejected']).withMessage('Invalid status'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be positive'),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be 1-50'),
  ],
  validate,
  adminController.getBusinesses
);

router.get(
  '/businesses/:businessId',
  [param('businessId').notEmpty().withMessage('Business ID is required')],
  validate,
  adminController.getBusinessById
);

router.put(
  '/businesses/:businessId/decision',
  [
    param('businessId').notEmpty().withMessage('Business ID is required'),
    body('decision').isIn(['approved', 'rejected']).withMessage('Decision must be approved or rejected'),
    body('rejectionReason').optional().isString().withMessage('Reason must be string'),
  ],
  validate,
  adminController.decideOnBusiness
);

// User management
router.get(
  '/users',
  [
    query('role').optional().isIn(['customer', 'business_admin']).withMessage('Invalid role'),
    query('status').optional().isIn(['active', 'suspended']).withMessage('Invalid status'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be positive'),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be 1-50'),
  ],
  validate,
  adminController.getUsers
);

router.put(
  '/users/:userId/suspend',
  [param('userId').notEmpty().withMessage('User ID is required')],
  validate,
  adminController.suspendUser
);

router.put(
  '/users/:userId/activate',
  [param('userId').notEmpty().withMessage('User ID is required')],
  validate,
  adminController.activateUser
);

router.delete(
  '/users/:userId',
  [param('userId').notEmpty().withMessage('User ID is required')],
  validate,
  adminController.deleteUser
);

module.exports = router;
