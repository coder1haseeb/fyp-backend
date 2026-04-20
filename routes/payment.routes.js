const express = require('express');
const { body, param } = require('express-validator');
const router = express.Router();

const paymentController = require('../controllers/payment.controller');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');

// All routes require customer auth
router.use(auth, authorize('customer'));

// Initiate JazzCash payment
router.post(
  '/jazzcash/initiate',
  [
    body('orderId').notEmpty().withMessage('Order ID is required'),
    body('mobileNumber').matches(/^[0-9]{10,}$/).withMessage('Valid mobile number is required'),
  ],
  validate,
  paymentController.initiateJazzCash
);

// Initiate Easypaisa payment
router.post(
  '/easypaisa/initiate',
  [
    body('orderId').notEmpty().withMessage('Order ID is required'),
    body('mobileNumber').matches(/^[0-9]{10,}$/).withMessage('Valid mobile number is required'),
  ],
  validate,
  paymentController.initiateEasypaisa
);

// Get payment status
router.get(
  '/:paymentId/status',
  [param('paymentId').notEmpty().withMessage('Payment ID is required')],
  validate,
  paymentController.getPaymentStatus
);

module.exports = router;
