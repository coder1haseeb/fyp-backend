const Notification = require('../models/Notification');
const { success, error } = require('../utils/ApiResponse');

// Get Notifications
const getNotifications = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    // Determine model based on user role
    const modelMap = {
      customer: 'Customer',
      business_admin: 'BusinessOwner',
      super_admin: 'Admin',
    };

    const recipientModel = modelMap[req.user.role];

    const total = await Notification.countDocuments({
      recipient: userId,
      recipientModel,
    });

    const unreadCount = await Notification.countDocuments({
      recipient: userId,
      recipientModel,
      isRead: false,
    });

    const notifications = await Notification.find({
      recipient: userId,
      recipientModel,
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    return success(res, 200, 'Notifications retrieved', {
      notifications,
      unreadCount,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        total,
        limit: parseInt(limit),
      },
    });
  } catch (err) {
    console.error('Get notifications error:', err);
    return error(res, 500, 'Error retrieving notifications', 'GET_NOTIFICATIONS_ERROR');
  }
};

// Mark as Read
const markAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user.userId;

    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, recipient: userId },
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      return error(res, 404, 'Notification not found', 'NOT_FOUND');
    }

    return success(res, 200, 'Marked as read', notification);
  } catch (err) {
    console.error('Mark as read error:', err);
    return error(res, 500, 'Error marking as read', 'MARK_READ_ERROR');
  }
};

// Mark All as Read
const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.userId;

    const modelMap = {
      customer: 'Customer',
      business_admin: 'BusinessOwner',
      super_admin: 'Admin',
    };

    const recipientModel = modelMap[req.user.role];

    const result = await Notification.updateMany(
      {
        recipient: userId,
        recipientModel,
        isRead: false,
      },
      { isRead: true }
    );

    return success(res, 200, 'All marked as read', {
      modifiedCount: result.modifiedCount,
    });
  } catch (err) {
    console.error('Mark all as read error:', err);
    return error(res, 500, 'Error marking all as read', 'MARK_ALL_ERROR');
  }
};

module.exports = {
  getNotifications,
  markAsRead,
  markAllAsRead,
};
