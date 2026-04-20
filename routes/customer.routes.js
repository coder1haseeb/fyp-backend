const express = require('express');
const { body, param } = require('express-validator');
const router = express.Router();

const customerController = require('../controllers/customer.controller');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');

// All routes require customer auth
router.use(auth, authorize('customer'));

// Profile routes
router.get('/profile', customerController.getProfile);

router.put(
  '/profile',
  [
    body('fullName').optional().notEmpty().withMessage('Full name cannot be empty'),
    body('phone').optional().matches(/^[0-9]{10,}$/).withMessage('Valid phone is required'),
    body('city').optional().notEmpty().withMessage('City cannot be empty'),
  ],
  validate,
  customerController.updateProfile
);

// Address routes
router.post(
  '/addresses',
  [
    body('label').notEmpty().withMessage('Label is required'),
    body('street').notEmpty().withMessage('Street is required'),
    body('city').notEmpty().withMessage('City is required'),
  ],
  validate,
  customerController.addAddress
);

router.put(
  '/addresses/:addressId',
  [
    param('addressId').notEmpty().withMessage('Address ID is required'),
    body('label').optional().notEmpty().withMessage('Label cannot be empty'),
    body('street').optional().notEmpty().withMessage('Street cannot be empty'),
    body('city').optional().notEmpty().withMessage('City cannot be empty'),
  ],
  validate,
  customerController.updateAddress
);

router.delete('/addresses/:addressId', param('addressId').notEmpty(), validate, customerController.deleteAddress);

// Password routes
router.put(
  '/change-password',
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
  ],
  validate,
  customerController.changePassword
);

// Insights route
router.get('/insights', customerController.getInsights);

module.exports = router;
