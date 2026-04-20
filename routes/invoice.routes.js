const express = require('express');
const { param } = require('express-validator');
const router = express.Router();

const invoiceController = require('../controllers/invoice.controller');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');

// All routes require auth
router.use(auth);

// Get invoice data
router.get(
  '/:orderId',
  [param('orderId').notEmpty().withMessage('Order ID is required')],
  validate,
  invoiceController.getInvoice
);

// Download invoice PDF
router.get(
  '/:orderId/download',
  [param('orderId').notEmpty().withMessage('Order ID is required')],
  validate,
  invoiceController.downloadInvoice
);

module.exports = router;
