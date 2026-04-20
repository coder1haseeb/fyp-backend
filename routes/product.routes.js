const express = require('express');
const { param } = require('express-validator');
const router = express.Router();

const productController = require('../controllers/product.controller');
const validate = require('../middleware/validate');

// Get product by ID
router.get(
  '/:productId',
  [param('productId').notEmpty().withMessage('Product ID is required')],
  validate,
  productController.getProductById
);

module.exports = router;
