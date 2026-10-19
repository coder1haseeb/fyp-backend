const express = require('express');
const { body, param } = require('express-validator');
const router = express.Router();

const paymentController = require('../controllers/payment.controller');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');

// Provider callback is authenticated with the JazzCash response signature.
router.post('/notification', paymentController.jazzCashNotification);
router.post('/rapidgateway/webhook', paymentController.rapidGatewayWebhook);
router.post('/safepay/webhook', paymentController.safepayWebhook);

// All customer routes require authentication.
router.use(auth, authorize('customer'));

// Initiate JazzCash payment
router.post('/safepay/initiate', [body('orderId').notEmpty().withMessage('Order ID is required')], validate, paymentController.initiateSafepay);

router.post(
  '/rapidgateway/initiate',
  [
    body('orderId').notEmpty().withMessage('Order ID is required'),
    body('mobileNumber').matches(/^[0-9]{10,}$/).withMessage('Valid mobile number is required'),
  ],
  validate,
  paymentController.initiateRapidGateway
);

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
router.get('/safepay/tracker/:tracker/status', paymentController.getSafepayTrackerStatus);

router.get(
  '/:paymentId/status',
  [param('paymentId').notEmpty().withMessage('Payment ID is required')],
  validate,
  paymentController.getPaymentStatus
);

module.exports = router;
