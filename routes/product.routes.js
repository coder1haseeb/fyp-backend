const express = require('express');
const { param, body } = require('express-validator');
const router = express.Router();

const productController = require('../controllers/product.controller');
const validate = require('../middleware/validate');
const auth = require('../middleware/auth');

// Public route - get all active products (for customer browsing)
// Must be defined BEFORE /:productId to avoid route conflicts
router.get(
  '/public',
  productController.getPublicProducts
);

// Public route - get product by ID
router.get(
  '/:productId',
  [param('productId').notEmpty().withMessage('Product ID is required')],
  validate,
  productController.getProductById
);

// Protected routes - business owner only
// Get products by business
router.get(
  '/business/:businessId/products',
  auth,
  [param('businessId').notEmpty().withMessage('Business ID is required')],
  validate,
  productController.getProductsByBusiness
);

// Create product
router.post(
  '/business/:businessId/products',
  auth,
  [
    param('businessId').notEmpty().withMessage('Business ID is required'),
    body('name').notEmpty().withMessage('Product name is required'),
    body('price').isNumeric().withMessage('Price must be a number'),
    body('stockQty').optional().isNumeric().withMessage('Stock quantity must be a number'),
  ],
  validate,
  productController.createProduct
);

// Get product for edit
router.get(
  '/:productId/edit',
  auth,
  [param('productId').notEmpty().withMessage('Product ID is required')],
  validate,
  productController.getProductForEdit
);

// Update product
router.put(
  '/:productId',
  auth,
  [
    param('productId').notEmpty().withMessage('Product ID is required'),
    body('name').optional().notEmpty().withMessage('Product name cannot be empty'),
    body('price').optional().isNumeric().withMessage('Price must be a number'),
    body('stockQty').optional().isNumeric().withMessage('Stock quantity must be a number'),
  ],
  validate,
  productController.updateProduct
);

// Delete product
router.delete(
  '/:productId',
  auth,
  [param('productId').notEmpty().withMessage('Product ID is required')],
  validate,
  productController.deleteProduct
);

module.exports = router;
