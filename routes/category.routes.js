const express = require('express');
const { param, body } = require('express-validator');
const router = express.Router();

const categoryController = require('../controllers/category.controller');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');

// Public route - get categories
router.get('/', categoryController.getCategories);

// Admin routes
const adminRoutes = express.Router();
adminRoutes.use(auth, authorize('super_admin'));

// Create category
adminRoutes.post(
  '/',
  [body('name').notEmpty().withMessage('Category name is required'), body('icon').optional().isString()],
  validate,
  categoryController.createCategory
);

// Update category
adminRoutes.put(
  '/:categoryId',
  [
    param('categoryId').notEmpty().withMessage('Category ID is required'),
    body('name').optional().notEmpty().withMessage('Name cannot be empty'),
  ],
  validate,
  categoryController.updateCategory
);

// Delete category
adminRoutes.delete(
  '/:categoryId',
  [param('categoryId').notEmpty().withMessage('Category ID is required')],
  validate,
  categoryController.deleteCategory
);

router.use('/admin/categories', adminRoutes);

// Service Areas Routes
// Get all service areas
adminRoutes.get('/service-areas', categoryController.getServiceAreas);

// Create service area
adminRoutes.post(
  '/service-areas',
  [body('city').notEmpty().withMessage('City name is required')],
  validate,
  categoryController.createServiceArea
);

// Update service area
adminRoutes.put(
  '/service-areas/:areaId',
  [
    param('areaId').notEmpty().withMessage('Area ID is required'),
    body('isActive').isBoolean().withMessage('isActive must be boolean'),
  ],
  validate,
  categoryController.updateServiceArea
);

module.exports = router;
