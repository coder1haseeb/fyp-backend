const express = require('express');
const { body, param, query } = require('express-validator');
const router = express.Router();

const orderController = require('../controllers/order.controller');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');

// All routes require customer auth
router.use(auth, authorize('customer'));

// Place order
router.post(
  '/',
  [
    body('deliveryAddress').notEmpty().withMessage('Delivery address is required'),
    body('deliveryAddress.street').notEmpty().withMessage('Street is required'),
    body('deliveryAddress.city').notEmpty().withMessage('City is required'),
    body('paymentMethod').isIn(['jazzcash', 'easypaisa', 'cod', 'pay_at_store']).withMessage('Invalid payment method'),
  ],
  validate,
  orderController.placeOrder
);

// Get orders
router.get(
  '/',
  [
    query('status')
      .optional()
      .isIn(['pending', 'confirmed', 'processing', 'ready', 'delivered', 'cancelled'])
      .withMessage('Invalid status'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be positive'),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be 1-50'),
  ],
  validate,
  orderController.getOrders
);

// Get order by ID
router.get(
  '/:orderId',
  [param('orderId').notEmpty().withMessage('Order ID is required')],
  validate,
  orderController.getOrderById
);

// Cancel order
router.put(
  '/:orderId/cancel',
  [param('orderId').notEmpty().withMessage('Order ID is required')],
  validate,
  orderController.cancelOrder
);

module.exports = router;
