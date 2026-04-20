const express = require('express');
const { param } = require('express-validator');
const router = express.Router();

const notificationController = require('../controllers/notification.controller');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');

// All routes require auth (any role)
router.use(auth);

// Get notifications
router.get('/', notificationController.getNotifications);

// Mark single as read
router.put(
  '/:notificationId/read',
  [param('notificationId').notEmpty().withMessage('Notification ID is required')],
  validate,
  notificationController.markAsRead
);

// Mark all as read
router.put('/read-all', notificationController.markAllAsRead);

module.exports = router;
