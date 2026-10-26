const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const authController = require('../controllers/auth.controller');
const validate = require('../middleware/validate');
const auth = require('../middleware/auth');

// Validation chains
const registerCustomerValidation = [
  body('fullName').notEmpty().withMessage('Full name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('phone').matches(/^[0-9]{10,}$/).withMessage('Valid phone number is required'),
  body('city').notEmpty().withMessage('City is required'),
];

const registerBusinessValidation = [
  body('fullName').notEmpty().withMessage('Full name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('phone').matches(/^[0-9]{10,}$/).withMessage('Valid phone number is required'),
  body('storeName').notEmpty().withMessage('Store name is required'),
  body('categoryId').isMongoId().withMessage('Select a valid category'),
  body('address').notEmpty().withMessage('Address is required'),
  body('city').notEmpty().withMessage('City is required'),
  body('storePhone').matches(/^[0-9]{10,}$/).withMessage('Valid phone number is required'),
  body('logo').optional().isString().withMessage('Logo must be a valid base64 string'),
];

const loginValidation = [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
];

const verifyEmailValidation = [
  body('email').isEmail().withMessage('Valid email is required'),
  body('otp').notEmpty().withMessage('OTP is required'),
];

const forgotPasswordValidation = [
  body('email').isEmail().withMessage('Valid email is required'),
];

const resetPasswordValidation = [
  body('email').isEmail().withMessage('Valid email is required'),
  body('otp').notEmpty().withMessage('OTP is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
];

// Routes
router.post('/register/customer', ...registerCustomerValidation, validate, authController.registerCustomer);
router.post('/register/business', ...registerBusinessValidation, validate, authController.registerBusiness);
router.post('/login', ...loginValidation, validate, authController.login);
router.post('/admin/login', ...loginValidation, validate, authController.adminLogin);
router.post('/verify-email', ...verifyEmailValidation, validate, authController.verifyEmail);
router.post('/resend-verification', body('email').isEmail(), validate, authController.resendVerificationCode);
router.post('/forgot-password', ...forgotPasswordValidation, validate, authController.forgotPassword);
router.post('/reset-password', ...resetPasswordValidation, validate, authController.resetPassword);
router.post('/logout', auth, authController.logout);

module.exports = router;
