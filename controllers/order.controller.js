const Order = require('../models/Order');
const Payment = require('../models/Payment');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const Business = require('../models/Business');
const { success, error } = require('../utils/ApiResponse');
const createNotification = require('../utils/createNotification');
const checkLowStockAndNotify = require('../utils/stockAlertChecker');
const recordInteraction = require('../utils/recordInteraction');

// Helper: Generate Order ID
const generateOrderId = async () => {
  const year = new Date().getFullYear();
  const count = await Order.countDocuments({ orderId: { $regex: `^ORD-${year}` } });
  const orderNumber = String(count + 1).padStart(5, '0');
  return `ORD-${year}-${orderNumber}`;
};

// Helper: Generate Invoice ID
const generateInvoiceId = async () => {
  const year = new Date().getFullYear();
  const count = await Order.countDocuments();
  const invoiceNumber = String(count + 1).padStart(5, '0');
  return `INV-${year}-${invoiceNumber}`;
};

// Place Order
const placeOrder = async (req, res) => {
  try {
    const { deliveryAddress, paymentMethod, notes } = req.body;
    const customerId = req.user.userId;

    // Get cart
    const cart = await Cart.findOne({ customer: customerId }).populate('items.product');
    if (!cart || cart.items.length === 0) {
      return error(res, 400, 'Cart is empty', 'EMPTY_CART');
    }

    // Group items by business
    const ordersByBusiness = {};

    for (const item of cart.items) {
      const product = item.product;

      if (!product || product.status !== 'active') {
        return error(res, 400, 'A product in your cart is no longer available', 'PRODUCT_UNAVAILABLE');
      }

      // Check stock
      if (product.stockQty < item.quantity) {
        return error(
          res,
          400,
          `Insufficient stock for ${product.name}`,
          'INSUFFICIENT_STOCK'
        );
      }

      const businessId = product.business.toString();
      if (!ordersByBusiness[businessId]) {
        ordersByBusiness[businessId] = [];
      }

      ordersByBusiness[businessId].push({
        product: product._id,
        quantity: item.quantity,
        unitPrice: product.price,
        total: product.price * item.quantity,
        productData: product,
      });
    }

    if (['jazzcash', 'easypaisa', 'rapidgateway'].includes(paymentMethod) && Object.keys(ordersByBusiness).length > 1) {
      return error(res, 400, 'Wallet checkout supports one store at a time. Please order from each store separately.', 'MULTI_STORE_WALLET');
    }

    // Create orders and payments
    const createdOrders = [];

    for (const [businessId, items] of Object.entries(ordersByBusiness)) {
      const totalAmount = items.reduce((sum, item) => sum + item.total, 0);

      // Generate order ID
      const orderId = await generateOrderId();

      // Create order
      const order = new Order({
        orderId,
        customer: customerId,
        business: businessId,
        items: items.map(({ product, quantity, unitPrice, total }) => ({
          product,
          quantity,
          unitPrice,
          total,
        })),
        deliveryAddress,
        paymentMethod,
        paymentStatus: paymentMethod === 'cod' || paymentMethod === 'pay_at_store' ? 'pending' : 'pending',
        status: 'pending',
        notes,
        totalAmount,
        currency: 'PKR',
        timeline: [
          {
            status: 'pending',
            timestamp: new Date(),
          },
        ],
      });

      await order.save();

      // Create payment record
      const payment = new Payment({
        order: order._id,
        method: paymentMethod,
        amount: totalAmount,
        currency: 'PKR',
        status: 'pending',
      });

      await payment.save();

      // Deduct stock
      for (const item of items) {
        await Product.findByIdAndUpdate(item.product, {
          $inc: { stockQty: -item.quantity },
        });

        // Check low stock
        await checkLowStockAndNotify(item.product);
      }

      // Notify business admin
      const business = await Business.findById(businessId).select('owner');
      await createNotification(
        business.owner,
        'BusinessOwner',
        'order_update',
        `New Order Received - ${orderId}`,
        `You have received a new order. Total: PKR ${totalAmount}`,
        {
          orderId: order._id,
          amount: totalAmount,
        }
      );

      createdOrders.push({
        order,
        payment,
      });
    }

    // Clear cart
    await Cart.findOneAndUpdate({ customer: customerId }, { items: [] });
    for (const created of createdOrders.filter(entry => ['cod', 'pay_at_store'].includes(entry.order.paymentMethod))) {
      for (const item of created.order.items) {
        await recordInteraction(customerId, item.product, 'purchase');
      }
    }

    return success(res, 201, 'Order(s) placed successfully', {
      orders: createdOrders.map((o) => ({
        orderId: o.order.orderId,
        id: o.order._id,
        totalAmount: o.order.totalAmount,
        paymentMethod: o.order.paymentMethod,
        paymentStatus: o.order.paymentStatus,
      })),
      message: 'Proceed to payment',
    });
  } catch (err) {
    console.error('Place order error:', err);
    return error(res, 500, 'Error placing order', 'PLACE_ORDER_ERROR');
  }
};

// Get Customer Orders
const getOrders = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const customerId = req.user.userId;
    const skip = (page - 1) * limit;

    const query = { customer: customerId };
    if (status) query.status = status;

    const total = await Order.countDocuments(query);
    const orders = await Order.find(query)
      .populate('business', 'storeName logo')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    return success(res, 200, 'Orders retrieved', {
      orders,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        total,
        limit: parseInt(limit),
      },
    });
  } catch (err) {
    console.error('Get orders error:', err);
    return error(res, 500, 'Error retrieving orders', 'GET_ORDERS_ERROR');
  }
};

// Get Order by ID
const getOrderById = async (req, res) => {
  try {
    const { orderId } = req.params;
    const customerId = req.user.userId;

    const order = await Order.findById(orderId)
      .populate('customer', 'fullName email phone')
      .populate('business', 'storeName phone address city')
      .populate('items.product', 'name price images');

    if (!order || order.customer._id.toString() !== customerId) {
      return error(res, 404, 'Order not found', 'NOT_FOUND');
    }

    return success(res, 200, 'Order retrieved', order);
  } catch (err) {
    console.error('Get order by ID error:', err);
    return error(res, 500, 'Error retrieving order', 'GET_ORDER_ERROR');
  }
};

// Cancel Order
const cancelOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const customerId = req.user.userId;

    const order = await Order.findById(orderId);

    if (!order || order.customer.toString() !== customerId) {
      return error(res, 404, 'Order not found', 'NOT_FOUND');
    }

    if (order.status !== 'pending') {
      return error(res, 400, 'Only pending orders can be cancelled', 'CANNOT_CANCEL');
    }

    // Restore stock
    for (const item of order.items) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { stockQty: item.quantity },
      });
    }

    order.status = 'cancelled';
    order.timeline.push({
      status: 'cancelled',
      timestamp: new Date(),
    });

    await order.save();

    // Notify business admin
    const business = await Business.findById(order.business).select('owner');
    await createNotification(
      business.owner,
      'BusinessOwner',
      'order_update',
      `Order Cancelled - ${order.orderId}`,
      `Order ${order.orderId} has been cancelled by the customer`,
      {
        orderId: order._id,
      }
    );

    return success(res, 200, 'Order cancelled successfully', order);
  } catch (err) {
    console.error('Cancel order error:', err);
    return error(res, 500, 'Error cancelling order', 'CANCEL_ORDER_ERROR');
  }
};

module.exports = {
  placeOrder,
  getOrders,
  getOrderById,
  cancelOrder,
};
