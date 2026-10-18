const crypto = require('crypto');
const axios = require('axios');
const Payment = require('../models/Payment');
const Order = require('../models/Order');
const Customer = require('../models/Customer');
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

const initiateRapidGateway = async (req, res) => {
  try {
    const { orderId, mobileNumber } = req.body;
    if (!mongoose.isValidObjectId(orderId)) return error(res, 400, 'Invalid order ID', 'INVALID_ORDER');
    const order = await Order.findOne({ _id: orderId, customer: req.user.userId, paymentMethod: 'rapidgateway' });
    if (!order) return error(res, 404, 'Order not found', 'NOT_FOUND');
    const payment = await Payment.findOne({ order: orderId, method: 'rapidgateway' });
    if (!payment) return error(res, 404, 'Payment record not found', 'NOT_FOUND');
    if (payment.status !== 'pending') return error(res, 400, 'Payment is not pending', 'INVALID_STATUS');

    const { RAPID_MERCHANT_ID, RAPID_CLIENT_ID, RAPID_CLIENT_SECRET, CLIENT_URL } = process.env;
    if (![RAPID_MERCHANT_ID, RAPID_CLIENT_ID, RAPID_CLIENT_SECRET, CLIENT_URL].every(Boolean)) {
      return error(res, 503, 'Rapid Gateway sandbox is not configured', 'GATEWAY_NOT_CONFIGURED');
    }
    const customer = await Customer.findById(req.user.userId).select('email');
    if (!customer) return error(res, 404, 'Customer not found', 'NOT_FOUND');

    const tokenResponse = await fetch('https://secure.rapid-gateway.com/oauth2/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${RAPID_CLIENT_ID}:${RAPID_CLIENT_SECRET}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
      signal: AbortSignal.timeout(15000),
    });
    const tokenData = await tokenResponse.json().catch(() => ({}));
    if (!tokenResponse.ok || !tokenData.access_token) {
      return error(res, 502, 'Rapid Gateway authentication failed', 'GATEWAY_AUTH_FAILED');
    }

    const frontendUrl = CLIENT_URL.replace(/\/$/, '');
    const fields = new URLSearchParams({
      MERCHANT_ID: RAPID_MERCHANT_ID,
      MERCHANT_NAME: 'University Project Store',
      TXNAMT: String(payment.amount),
      CURRENCY_CODE: 'PKR',
      CUSTOMER_MOBILE_NO: mobileNumber,
      CUSTOMER_EMAIL_ADDRESS: customer.email,
      BASKET_ID: order.orderId,
      SUCCESS_URL: `${frontendUrl}/payment/callback`,
      FAILURE_URL: `${frontendUrl}/payment/callback`,
      CHECKOUT_URL: `${frontendUrl}/payment/callback`,
      VERSION: 'MY_VER_1.0',
      PROCCODE: '0',
    });
    const gatewayResponse = await fetch('https://secure.rapid-gateway.com/rapid/process-transaction', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: fields.toString(),
      redirect: 'manual',
      signal: AbortSignal.timeout(15000),
    });
    const redirectUrl = gatewayResponse.headers.get('location');
    let checkoutUrl;
    try { checkoutUrl = new URL(redirectUrl); } catch { /* Invalid gateway response. */ }
    if (!gatewayResponse.ok && ![301, 302, 303, 307, 308].includes(gatewayResponse.status)) {
      return error(res, 502, 'Rapid Gateway could not start checkout', 'GATEWAY_START_FAILED');
    }
    if (!checkoutUrl || checkoutUrl.protocol !== 'https:' || checkoutUrl.hostname !== 'secure.rapid-gateway.com') {
      return error(res, 502, 'Rapid Gateway returned an invalid checkout URL', 'GATEWAY_REDIRECT_INVALID');
    }
    payment.transactionReference = order.orderId;
    await payment.save();
    return success(res, 200, 'Payment initiated', { paymentId: payment._id, redirectUrl: checkoutUrl.toString() });
  } catch (err) {
    console.error('Rapid Gateway initiation error:', err);
    return error(res, 502, 'Could not start Rapid Gateway checkout', 'GATEWAY_ERROR');
  }
};

const rapidGatewayWebhook = async (req, res) => {
  try {
    const salt = process.env.RAPID_WEBHOOK_SALT;
    const timestamp = req.get('X-RapidGateway-Timestamp');
    const signature = req.get('X-RapidGateway-Signature');
    const signedAt = Number(timestamp);
    if (!salt || !req.rawBody || !/^\d+$/.test(timestamp || '') ||
        !Number.isSafeInteger(signedAt) ||
        Math.abs(Math.floor(Date.now() / 1000) - signedAt) > 300 ||
        !/^[A-F0-9]{64}$/.test(signature || '')) {
      return error(res, 401, 'Invalid webhook signature', 'INVALID_SIGNATURE');
    }
    const expected = crypto.createHmac('sha256', salt)
      .update(Buffer.concat([Buffer.from(`${timestamp}.`), req.rawBody]))
      .digest('hex').toUpperCase();
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      return error(res, 401, 'Invalid webhook signature', 'INVALID_SIGNATURE');
    }

    const event = req.body;
    if (event.eventType === 'webhook.test') return success(res, 200, 'Test webhook received', {});
    if (!['transaction.completed', 'transaction.failed'].includes(event.eventType)) {
      return success(res, 200, 'Webhook ignored', {});
    }
    if (String(event.merchantId) !== process.env.RAPID_MERCHANT_ID ||
        typeof event.merchantTransactionId !== 'string' ||
        event.currency !== 'PKR') {
      return error(res, 400, 'Payment details do not match', 'PAYMENT_MISMATCH');
    }
    const payment = await Payment.findOne({
      transactionReference: event.merchantTransactionId,
      method: 'rapidgateway',
    }).populate('order');
    if (!payment || !payment.order || Number(event.amount) !== payment.amount) {
      return error(res, 400, 'Payment details do not match', 'PAYMENT_MISMATCH');
    }
    if (payment.status !== 'pending') return success(res, 200, 'Webhook already applied', {});
    if (event.eventType === 'transaction.completed' && event.status !== 'SUCCESS') {
      return error(res, 400, 'Payment status does not match event', 'PAYMENT_MISMATCH');
    }
    payment.status = event.eventType === 'transaction.completed' ? 'paid' : 'failed';
    if (payment.status === 'paid') payment.paidAt = new Date();
    await payment.save();
    const order = await Order.findByIdAndUpdate(payment.order._id, { paymentStatus: payment.status }, { new: true });
    if (payment.status === 'paid' && order) {
      for (const item of order.items) await recordInteraction(order.customer, item.product, 'purchase');
    }
    return success(res, 200, 'Webhook received', {});
  } catch (err) {
    console.error('Rapid Gateway webhook error:', err);
    return error(res, 500, 'Could not process payment webhook', 'WEBHOOK_ERROR');
  }
};

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
  initiateRapidGateway,
  rapidGatewayWebhook,
  initiateJazzCash,
  initiateEasypaisa,
  getPaymentStatus,
  jazzCashNotification,
};
