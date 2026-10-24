const express = require('express');
const { query, param } = require('express-validator');
const router = express.Router();

const storeController = require('../controllers/store.controller');
const validate = require('../middleware/validate');

router.get('/nearby', [
  query('latitude').isFloat({ min: -90, max: 90 }),
  query('longitude').isFloat({ min: -180, max: 180 }),
  query('radiusKm').optional().isFloat({ min: 0.1, max: 50 }),
  query('limit').optional().isInt({ min: 1, max: 50 }),
], validate, storeController.getNearbyStores);

// Get all stores
router.get(
  '/',
  [
    query('city').optional().isString().withMessage('City must be a string'),
    query('category').optional().isString().withMessage('Category must be a string'),
    query('rating').optional().isFloat({ min: 0, max: 5 }).withMessage('Rating must be 0-5'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be positive'),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be 1-50'),
  ],
  validate,
  storeController.getStores
);

// Get store by ID
router.get(
  '/:storeId',
  [param('storeId').notEmpty().withMessage('Store ID is required')],
  validate,
  storeController.getStoreById
);

// Get store products
router.get(
  '/:storeId/products',
  [
    param('storeId').notEmpty().withMessage('Store ID is required'),
    query('category').optional().isString().withMessage('Category must be a string'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be positive'),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be 1-50'),
  ],
  validate,
  storeController.getStoreProducts
);

module.exports = router;
