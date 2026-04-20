const express = require('express');
const { param, body, query } = require('express-validator');
const router = express.Router();

const recommendationController = require('../controllers/recommendation.controller');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');

// All routes require customer auth
router.use(auth, authorize('customer'));

// Get recommendations
router.get(
  '/',
  [query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be 1-50')],
  validate,
  recommendationController.getRecommendations
);

// Get similar products
router.get(
  '/similar/:productId',
  [
    param('productId').notEmpty().withMessage('Product ID is required'),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be 1-50'),
  ],
  validate,
  recommendationController.getSimilarProducts
);

// Log interaction
router.post(
  '/interaction',
  [
    body('productId').notEmpty().withMessage('Product ID is required'),
    body('interactionType')
      .isIn(['view', 'add_to_cart', 'purchase', 'search'])
      .withMessage('Invalid interaction type'),
    body('durationSeconds').optional().isInt({ min: 0 }).withMessage('Duration must be non-negative'),
  ],
  validate,
  recommendationController.logInteraction
);

module.exports = router;
