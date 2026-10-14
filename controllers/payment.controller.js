const crypto = require('crypto');
const axios = require('axios');
const Payment = require('../models/Payment');
const Order = require('../models/Order');
const mongoose = require('mongoose');
const recordInteraction = require('../utils/recordInteraction');
const { success, error } = require('../utils/ApiResponse');

const jazzCashHash = (fields) => crypto.createHash('sha256').update(
  process.env.JAZZCASH_HASH_KEY + Object.keys(fields)
    .filter(key => key !== 'pp_SecureHash' && fields[key] !== '' && fields[key] != null)
    .sort()
    .map(key => String(fields[key]))
    .join('')
).digest('hex');

// Initiate JazzCash Payment
const initiateJazzCash = async (req, res) => {
  try {
    const { orderId, mobileNumber } = req.body;
    if (!mongoose.isValidObjectId(orderId)) return error(res, 400, 'Invalid order ID', 'INVALID_ORDER');
    const order = await Order.findOne({ _id: orderId, customer: req.user.userId, paymentMethod: 'jazzcash' });
    if (!order) return error(res, 404, 'Order not found', 'NOT_FOUND');

    const payment = await Payment.findOne({
      order: orderId,
      method: 'jazzcash',
    }).populate('order');

    if (!payment) {
      return error(res, 404, 'Payment record not found', 'NOT_FOUND');
    }
    if (payment.status !== 'pending') return error(res, 400, 'Payment is not pending', 'INVALID_STATUS');

    // Prepare JazzCash parameters
    const params = {
      pp_Version: '1.1',
      pp_TxnType: 'MPAY',
      pp_Language: 'EN',
      pp_MerchantID: process.env.JAZZCASH_MERCHANT_ID,
      pp_SubMerchantID: '',
      pp_Password: process.env.JAZZCASH_PASSWORD,
      pp_BankID: '',
      pp_ProductID: '',
      pp_TxnRefNo: `TXN-${Date.now()}`,
      pp_Amount: Math.round(payment.amount * 100), // In paisas
      pp_CurrencyCode: 'PKR',
      pp_TxnCurrency: 'PKR',
      pp_BillReference: payment.order.orderId,
      pp_Description: `Payment for order ${payment.order.orderId}`,
      pp_TxnDateTime: new Date().toISOString().replace(/[:.]/g, '').slice(0, -5),
      pp_BillingAddress: 'Address',
      pp_BillingCity: 'City',
      pp_BillingState: 'State',
      pp_BillingZipPostalCode: '12345',
      pp_BillingCountry: 'PK',
      pp_BillingTelephone: mobileNumber,
      pp_BillingEmail: 'customer@localbiz.pk',
      pp_ShippingAddress: 'Address',
      pp_ShippingCity: 'City',
      pp_ShippingState: 'State',
      pp_ShippingZipPostalCode: '12345',
      pp_ShippingCountry: 'PK',
      pp_ShippingTelephone: mobileNumber,
      pp_ShippingEmail: 'customer@localbiz.pk',
      pp_CustomerID: '',
      pp_CustomerTelephone: mobileNumber,
      pp_CustomerEmail: 'customer@localbiz.pk',
      pp_CustomerMobileNumber: mobileNumber,
      pp_MobileNumber: mobileNumber,
      pp_CNIC: '',
      pp_ReturnURL: `${process.env.CLIENT_URL}/payment/callback`,
      pp_NotificationURL: `${process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`}/api/v1/payments/notification`,
      pp_IRN: '',
      pp_SecureHash: '',
    };

    // Generate secure hash
    params.pp_SecureHash = jazzCashHash(params);

    payment.transactionReference = params.pp_TxnRefNo;
    await payment.save();

    return success(res, 200, 'Payment initiated', {
      paymentId: payment._id,
      apiUrl: process.env.JAZZCASH_API_URL,
      params,
    });
  } catch (err) {
    console.error('JazzCash initiation error:', err);
    return error(res, 500, 'Error initiating JazzCash payment', 'JAZZCASH_ERROR');
  }
};

// Initiate Easypaisa Payment
const initiateEasypaisa = async (req, res) => {
  try {
    const { orderId, mobileNumber } = req.body;
    if (!mongoose.isValidObjectId(orderId)) return error(res, 400, 'Invalid order ID', 'INVALID_ORDER');
    const order = await Order.findOne({ _id: orderId, customer: req.user.userId, paymentMethod: 'easypaisa' });
    if (!order) return error(res, 404, 'Order not found', 'NOT_FOUND');

    const payment = await Payment.findOne({
      order: orderId,
      method: 'easypaisa',
    }).populate('order');

    if (!payment) {
      return error(res, 404, 'Payment record not found', 'NOT_FOUND');
    }
    if (payment.status !== 'pending') return error(res, 400, 'Payment is not pending', 'INVALID_STATUS');

    const params = {
      storeId: process.env.EASYPAISA_STORE_ID,
      amount: Math.round(payment.amount * 100), // In paisas
      orderRefNum: `ORD-${Date.now()}`,
      expiryDate: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      autoRedirect: 'Y',
      postBackURL: `${process.env.CLIENT_URL}/payment/callback`,
      mobileNum: mobileNumber,
    };

    // Generate secure hash
    const hashString = `${params.storeId}${params.orderRefNum}${params.amount}${process.env.EASYPAISA_HASH_KEY}`;
    params.secure_hash = crypto.createHash('sha256').update(hashString).digest('hex');

    payment.transactionReference = params.orderRefNum;
    await payment.save();

    return success(res, 200, 'Payment initiated', {
      paymentId: payment._id,
      apiUrl: process.env.EASYPAISA_API_URL,
      params,
    });
  } catch (err) {
    console.error('Easypaisa initiation error:', err);
    return error(res, 500, 'Error initiating Easypaisa payment', 'EASYPAISA_ERROR');
  }
};

// Get Payment Status
const getPaymentStatus = async (req, res) => {
  try {
    const { paymentId } = req.params;

    const payment = await Payment.findById(paymentId).populate('order').lean();

    if (!payment) {
      return error(res, 404, 'Payment not found', 'NOT_FOUND');
    }
    if (payment.order.customer.toString() !== req.user.userId) {
      return error(res, 403, 'Not authorized to view this payment', 'UNAUTHORIZED');
    }

    return success(res, 200, 'Payment status retrieved', {
      paymentId: payment._id,
      status: payment.status,
      amount: payment.amount,
      method: payment.method,
      orderId: payment.order.orderId,
      transactionReference: payment.transactionReference,
      paidAt: payment.paidAt,
    });
  } catch (err) {
    console.error('Get payment status error:', err);
    return error(res, 500, 'Error retrieving payment status', 'STATUS_ERROR');
  }
};

const jazzCashNotification = async (req, res) => {
  try {
    const fields = req.body;
    const suppliedHash = String(fields.pp_SecureHash || '');
    const expectedHash = jazzCashHash(fields);
    if (!suppliedHash || suppliedHash.length !== expectedHash.length ||
        !crypto.timingSafeEqual(Buffer.from(suppliedHash.toLowerCase()), Buffer.from(expectedHash))) {
      return error(res, 400, 'Invalid payment signature', 'INVALID_SIGNATURE');
    }
    const payment = await Payment.findOne({ transactionReference: fields.pp_TxnRefNo, method: 'jazzcash' });
    if (!payment || Number(fields.pp_Amount) !== Math.round(payment.amount * 100) ||
        fields.pp_MerchantID !== process.env.JAZZCASH_MERCHANT_ID) {
      return error(res, 400, 'Payment details do not match', 'PAYMENT_MISMATCH');
    }
    if (payment.status === 'pending') {
      payment.status = fields.pp_ResponseCode === '000' ? 'paid' : 'failed';
      if (payment.status === 'paid') payment.paidAt = new Date();
      await payment.save();
      const order = await Order.findByIdAndUpdate(payment.order, { paymentStatus: payment.status }, { new: true });
      if (payment.status === 'paid' && order) {
        for (const item of order.items) await recordInteraction(order.customer, item.product, 'purchase');
      }
    }
    return success(res, 200, 'Payment notification received', {});
  } catch (err) {
    console.error('JazzCash notification error:', err);
    return error(res, 500, 'Could not process payment notification', 'NOTIFICATION_ERROR');
  }
};

module.exports = {
  initiateJazzCash,
  initiateEasypaisa,
  getPaymentStatus,
  jazzCashNotification,
};
