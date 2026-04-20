const crypto = require('crypto');
const axios = require('axios');
const Payment = require('../models/Payment');
const Order = require('../models/Order');
const { success, error } = require('../utils/ApiResponse');

// Initiate JazzCash Payment
const initiateJazzCash = async (req, res) => {
  try {
    const { orderId, mobileNumber } = req.body;

    const payment = await Payment.findOne({
      order: orderId,
      method: 'jazzcash',
    }).populate('order');

    if (!payment) {
      return error(res, 404, 'Payment record not found', 'NOT_FOUND');
    }

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
      pp_NotificationURL: `${process.env.CLIENT_URL}/api/v1/payments/notification`,
      pp_IRN: '',
      pp_SecureHash: '',
    };

    // Generate secure hash
    const sortedParams = Object.keys(params)
      .sort()
      .map((key) => `${key}=${params[key]}`)
      .join('&');

    const hashString = sortedParams + process.env.JAZZCASH_HASH_KEY;
    params.pp_SecureHash = crypto.createHash('sha256').update(hashString).digest('hex');

    payment.transactionReference = params.pp_TxnRefNo;
    await payment.save();

    return success(res, 200, 'Payment initiated', {
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

    const payment = await Payment.findOne({
      order: orderId,
      method: 'easypaisa',
    }).populate('order');

    if (!payment) {
      return error(res, 404, 'Payment record not found', 'NOT_FOUND');
    }

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

module.exports = {
  initiateJazzCash,
  initiateEasypaisa,
  getPaymentStatus,
};
