const express = require('express');
const { body, param } = require('express-validator');
const router = express.Router();

const cartController = require('../controllers/cart.controller');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');

// All routes require customer auth
router.use(auth, authorize('customer'));

// Get cart
router.get('/', cartController.getCart);

// Add to cart
router.post(
  '/',
  [
    body('productId').notEmpty().withMessage('Product ID is required'),
    body('quantity').optional().isInt({ min: 1 }).withMessage('Quantity must be positive'),
  ],
  validate,
  cartController.addToCart
);

// Update cart item
router.put(
  '/:cartItemId',
  [
    param('cartItemId').notEmpty().withMessage('Cart item ID is required'),
    body('quantity').isInt({ min: 1 }).withMessage('Quantity must be positive'),
  ],
  validate,
  cartController.updateCartItem
);

// Remove cart item
router.delete(
  '/:cartItemId',
  [param('cartItemId').notEmpty().withMessage('Cart item ID is required')],
  validate,
  cartController.removeCartItem
);

// Clear cart
router.delete('/', cartController.clearCart);

module.exports = router;
