const Order = require('../models/Order');
const Payment = require('../models/Payment');
const Business = require('../models/Business');
const mongoose = require('mongoose');
const createNotification = require('../utils/createNotification');
const { success, error } = require('../utils/ApiResponse');

const validProof = value => typeof value === 'string' &&
  value.length <= 3 * 1024 * 1024 &&
  /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value);

const uploadProof = async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.orderId, customer: req.user.userId, paymentMethod: 'bank_transfer' });
    if (!order) return error(res, 404, 'Bank transfer order not found', 'NOT_FOUND');
    if (order.status === 'cancelled' || order.paymentStatus === 'paid') return error(res, 400, 'This order cannot accept payment proof', 'ORDER_CLOSED');
    if (!validProof(req.body.proofImage)) return error(res, 400, 'Upload a JPG, PNG, or WebP image smaller than 2 MB', 'INVALID_PROOF');
    const payment = await Payment.findOneAndUpdate(
      { order: order._id, method: 'bank_transfer', proofStatus: { $in: ['none', 'rejected'] }, status: 'pending' },
      { $set: { proofImage: req.body.proofImage, proofStatus: 'submitted', proofSubmittedAt: new Date(), proofReviewedAt: null } },
      { new: true }
    );
    if (!payment) return error(res, 409, 'Proof already submitted or payment is unavailable', 'PROOF_ALREADY_SUBMITTED');
    const business = await Business.findById(order.business).select('owner');
    if (business) {
      try {
        await createNotification(business.owner, 'BusinessOwner', 'order_update',
          `Payment proof submitted - ${order.orderId}`, 'Review the bank transfer proof before marking this order paid.', { orderId: order._id });
      } catch (notificationError) { console.error('Payment proof notification error:', notificationError); }
    }
    return success(res, 200, 'Payment proof submitted for store review', { proofStatus: payment.proofStatus });
  } catch (err) {
    console.error('Upload payment proof error:', err);
    return error(res, 500, 'Could not upload payment proof', 'PROOF_UPLOAD_ERROR');
  }
};

const getProof = async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.orderId, business: req.user.businessId, paymentMethod: 'bank_transfer' });
    if (!order) return error(res, 404, 'Bank transfer order not found', 'NOT_FOUND');
    const payment = await Payment.findOne({ order: order._id, method: 'bank_transfer' }).select('+proofImage');
    if (!payment) return error(res, 404, 'Payment record not found', 'NOT_FOUND');
    res.set('Cache-Control', 'no-store');
    return success(res, 200, 'Payment proof retrieved', {
      proofImage: payment.proofImage,
      proofStatus: payment.proofStatus,
      proofSubmittedAt: payment.proofSubmittedAt,
    });
  } catch (err) {
    console.error('Get payment proof error:', err);
    return error(res, 500, 'Could not retrieve payment proof', 'PROOF_GET_ERROR');
  }
};

const getCustomerProof = async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.orderId, customer: req.user.userId, paymentMethod: 'bank_transfer' });
    if (!order) return error(res, 404, 'Bank transfer order not found', 'NOT_FOUND');
    const payment = await Payment.findOne({ order: order._id, method: 'bank_transfer' }).select('+proofImage');
    if (!payment) return error(res, 404, 'Payment record not found', 'NOT_FOUND');
    res.set('Cache-Control', 'no-store');
    return success(res, 200, 'Payment proof retrieved', {
      proofImage: payment.proofImage,
      proofStatus: payment.proofStatus,
      proofSubmittedAt: payment.proofSubmittedAt,
    });
  } catch (err) {
    console.error('Get customer payment proof error:', err);
    return error(res, 500, 'Could not retrieve payment proof', 'PROOF_GET_ERROR');
  }
};

const reviewProof = async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.orderId, business: req.user.businessId, paymentMethod: 'bank_transfer' });
    if (!order) return error(res, 404, 'Bank transfer order not found', 'NOT_FOUND');
    if (order.status === 'cancelled' || order.paymentStatus === 'paid') return error(res, 400, 'This order cannot be reviewed', 'ORDER_CLOSED');
    const accepted = req.body.decision === 'accept';
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const now = new Date();
        const payment = await Payment.findOneAndUpdate(
          { order: order._id, method: 'bank_transfer', proofStatus: 'submitted' },
          { $set: { proofStatus: accepted ? 'accepted' : 'rejected', proofReviewedAt: now,
            ...(accepted ? { status: 'paid', paidAt: now } : {}) } },
          { session, new: true }
        );
        if (!payment) throw new Error('No payment proof is awaiting review');
        if (accepted) {
          const updated = await Order.updateOne(
            { _id: order._id, status: { $ne: 'cancelled' }, paymentStatus: 'pending' },
            { $set: { paymentStatus: 'paid' } }, { session }
          );
          if (!updated.modifiedCount) throw new Error('Order is no longer awaiting payment');
        }
      });
    } finally {
      await session.endSession();
    }
    try {
      await createNotification(order.customer, 'Customer', 'order_update',
        `Payment proof ${accepted ? 'accepted' : 'rejected'} - ${order.orderId}`,
        accepted ? 'Your bank transfer has been confirmed.' : 'Your proof was rejected. Please upload a new image or contact the store.',
        { orderId: order._id });
    } catch (notificationError) { console.error('Payment review notification error:', notificationError); }
    return success(res, 200, `Payment proof ${accepted ? 'accepted' : 'rejected'}`, { proofStatus: accepted ? 'accepted' : 'rejected', paymentStatus: accepted ? 'paid' : 'pending' });
  } catch (err) {
    console.error('Review payment proof error:', err);
    return error(res, 500, 'Could not review payment proof', 'PROOF_REVIEW_ERROR');
  }
};

module.exports = { uploadProof, getProof, getCustomerProof, reviewProof };
