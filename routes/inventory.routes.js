const express = require('express');
const { param, body, query } = require('express-validator');
const router = express.Router();

const inventoryController = require('../controllers/inventory.controller');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');

// All routes require business_admin auth
router.use(auth, authorize('business_admin'));

// Get inventory
router.get('/', inventoryController.getInventory);

// Get low stock alerts
router.get('/alerts', inventoryController.getLowStockAlerts);

// Update stock
router.put(
  '/:productId/stock',
  [
    param('productId').notEmpty().withMessage('Product ID is required'),
    body('operation').isIn(['set', 'increment', 'decrement']).withMessage('Invalid operation'),
    body('quantity').isInt({ min: 0 }).withMessage('Quantity must be non-negative'),
  ],
  validate,
  inventoryController.updateStock
);

// Export inventory CSV
router.get('/export', inventoryController.exportInventoryCSV);

module.exports = router;
