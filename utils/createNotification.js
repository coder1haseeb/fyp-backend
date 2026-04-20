const Notification = require('../models/Notification');

const createNotification = async (recipientId, recipientModel, type, title, message, metadata = {}) => {
  try {
    const notification = new Notification({
      recipient: recipientId,
      recipientModel,
      type,
      title,
      message,
      metadata,
      isRead: false,
    });

    await notification.save();
    console.log(`✅ Notification created for ${recipientModel}`);
    return notification;
  } catch (error) {
    console.error('❌ Error creating notification:', error);
    throw error;
  }
};

module.exports = createNotification;
