const express = require('express');
const { body, param, query } = require('express-validator');
const router = express.Router();

const businessController = require('../controllers/business.controller');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const bankTransfer = require('../controllers/bankTransfer.controller');

// All routes require business_admin auth
router.use(auth, authorize('business_admin'));

// Profile routes
router.get('/profile', businessController.getBusinessProfile);

router.put(
  '/profile',
  [
    body('storeName').optional().notEmpty().withMessage('Store name cannot be empty'),
    body('phone').optional().matches(/^[0-9]{10,}$/).withMessage('Valid phone is required'),
  ],
  validate,
  businessController.updateBusinessProfile
);

// Product routes
router.get(
  '/products',
  [
    query('category').optional().isString().withMessage('Category must be string'),
    query('status').optional().isIn(['active', 'draft']).withMessage('Invalid status'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be positive'),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be 1-50'),
  ],
  validate,
  businessController.getProducts
);

router.post(
  '/products',
  [
    body('name').notEmpty().withMessage('Product name is required'),
    body('price').isFloat({ min: 0 }).withMessage('Price must be non-negative'),
    body('stockQty').optional().isInt({ min: 0 }).withMessage('Stock must be non-negative'),
  ],
  validate,
  businessController.addProduct
);

router.put(
  '/products/:productId',
  [
    param('productId').notEmpty().withMessage('Product ID is required'),
    body('name').optional().notEmpty().withMessage('Name cannot be empty'),
    body('price').optional().isFloat({ min: 0 }).withMessage('Price must be non-negative'),
  ],
  validate,
  businessController.updateProduct
);

router.delete(
  '/products/:productId',
  [param('productId').notEmpty().withMessage('Product ID is required')],
  validate,
  businessController.deleteProduct
);

// Order routes
router.get(
  '/orders',
  [
    query('status')
      .optional()
      .isIn(['pending', 'confirmed', 'processing', 'ready', 'delivered', 'cancelled'])
      .withMessage('Invalid status'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be positive'),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be 1-50'),
  ],
  validate,
  businessController.getOrders
);

router.get(
  '/orders/:orderId',
  [param('orderId').notEmpty().withMessage('Order ID is required')],
  validate,
  businessController.getOrderById
);

router.get('/orders/:orderId/payment-proof', [param('orderId').isMongoId()], validate, bankTransfer.getProof);
router.put('/orders/:orderId/payment-proof', [
  param('orderId').isMongoId(),
  body('decision').isIn(['accept', 'reject']),
], validate, bankTransfer.reviewProof);

router.put(
  '/orders/:orderId/status',
  [
    param('orderId').notEmpty().withMessage('Order ID is required'),
    body('status')
      .isIn(['confirmed', 'processing', 'ready', 'delivered', 'cancelled'])
      .withMessage('Invalid status'),
  ],
  validate,
  businessController.updateOrderStatus
);

// Return routes
router.get(
  '/returns',
  [
    query('status').optional().isIn(['pending', 'approved', 'rejected']).withMessage('Invalid status'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be positive'),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be 1-50'),
  ],
  validate,
  businessController.getReturns
);

router.put(
  '/returns/:returnId',
  [
    param('returnId').notEmpty().withMessage('Return ID is required'),
    body('status').isIn(['approved', 'rejected']).withMessage('Invalid status'),
    body('adminNote').optional().isString().withMessage('Note must be string'),
  ],
  validate,
  businessController.handleReturn
);

module.exports = router;
