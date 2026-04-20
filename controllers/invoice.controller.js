const Order = require('../models/Order');
const { success, error } = require('../utils/ApiResponse');
const generateInvoicePDF = require('../utils/generateInvoicePDF');

// Get Invoice
const getInvoice = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.userId;
    const userRole = req.user.role;

    const order = await Order.findById(orderId)
      .populate('customer', 'fullName email phone city')
      .populate('business', 'storeName address city phone')
      .populate('items.product', 'name price');

    if (!order) {
      return error(res, 404, 'Order not found', 'NOT_FOUND');
    }

    // Check ownership
    if (userRole === 'customer' && order.customer._id.toString() !== userId) {
      return error(res, 403, 'Access denied', 'FORBIDDEN');
    }

    if (userRole === 'business_admin' && order.business._id.toString() !== req.user.businessId) {
      return error(res, 403, 'Access denied', 'FORBIDDEN');
    }

    const invoiceData = {
      invoiceNumber: `INV-${order.orderId}`,
      orderId: order.orderId,
      date: order.createdAt,
      customer: {
        fullName: order.customer.fullName,
        email: order.customer.email,
        phone: order.customer.phone,
        city: order.customer.city,
      },
      store: {
        storeName: order.business.storeName,
        address: order.business.address,
        city: order.business.city,
        phone: order.business.phone,
      },
      deliveryAddress: order.deliveryAddress,
      items: order.items.map((item) => ({
        productName: item.product.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.total,
      })),
      subtotal: order.totalAmount,
      tax: 0,
      totalAmount: order.totalAmount,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      orderStatus: order.status,
    };

    return success(res, 200, 'Invoice data retrieved', invoiceData);
  } catch (err) {
    console.error('Get invoice error:', err);
    return error(res, 500, 'Error retrieving invoice', 'GET_INVOICE_ERROR');
  }
};

// Download Invoice PDF
const downloadInvoice = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.userId;
    const userRole = req.user.role;

    const order = await Order.findById(orderId)
      .populate('customer', 'fullName email phone city')
      .populate('business', 'storeName address city phone')
      .populate('items.product', 'name price');

    if (!order) {
      return error(res, 404, 'Order not found', 'NOT_FOUND');
    }

    // Check ownership
    if (userRole === 'customer' && order.customer._id.toString() !== userId) {
      return error(res, 403, 'Access denied', 'FORBIDDEN');
    }

    if (userRole === 'business_admin' && order.business._id.toString() !== req.user.businessId) {
      return error(res, 403, 'Access denied', 'FORBIDDEN');
    }

    const orderData = {
      orderId: order.orderId,
      createdAt: order.createdAt,
      customer: order.customer,
      store: order.business,
      deliveryAddress: order.deliveryAddress,
      items: order.items.map((item) => ({
        productName: item.product.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.total,
      })),
      totalAmount: order.totalAmount,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
    };

    const pdfBuffer = await generateInvoicePDF(orderData);

    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `attachment; filename="invoice_${order.orderId}.pdf"`);
    return res.send(pdfBuffer);
  } catch (err) {
    console.error('Download invoice error:', err);
    return error(res, 500, 'Error generating PDF', 'PDF_ERROR');
  }
};

module.exports = {
  getInvoice,
  downloadInvoice,
};
