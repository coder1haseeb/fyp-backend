const express = require('express');
const { body, query } = require('express-validator');
const router = express.Router();

const returnController = require('../controllers/return.controller');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');

// All routes require customer auth
router.use(auth, authorize('customer'));

// Create return
router.post(
  '/',
  [
    body('orderId').notEmpty().withMessage('Order ID is required'),
    body('productId').notEmpty().withMessage('Product ID is required'),
    body('reason').notEmpty().withMessage('Reason is required'),
    body('description').optional().isString().withMessage('Description must be string'),
  ],
  validate,
  returnController.createReturn
);

// Get returns
router.get(
  '/',
  [
    query('status')
      .optional()
      .isIn(['pending', 'approved', 'rejected'])
      .withMessage('Invalid status'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be positive'),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be 1-50'),
  ],
  validate,
  returnController.getReturns
);

module.exports = router;
