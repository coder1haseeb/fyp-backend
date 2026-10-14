const Order = require('../models/Order');
const Product = require('../models/Product');
const mongoose = require('mongoose');
const { success, error } = require('../utils/ApiResponse');

// Get Dashboard Summary
const getDashboardSummary = async (req, res) => {
  try {
    const businessId = req.user.businessId;

    // Today's date
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayOrders = await Order.find({
      business: businessId,
      createdAt: { $gte: today },
      status: { $ne: 'cancelled' },
    });

    const todayRevenue = todayOrders.reduce((sum, order) => sum + order.totalAmount, 0);

    // All time revenue
    const allOrders = await Order.find({
      business: businessId,
      status: { $ne: 'cancelled' },
    });

    const totalRevenue = allOrders.reduce((sum, order) => sum + order.totalAmount, 0);

    // Pending orders
    const pendingOrders = await Order.countDocuments({
      business: businessId,
      status: { $in: ['pending', 'confirmed', 'processing'] },
    });

    // Low stock products
    const lowStockProducts = await Product.countDocuments({
      business: businessId,
      stockQty: { $gt: 0, $lte: 5 },
    });

    return success(res, 200, 'Dashboard summary retrieved', {
      totalRevenue,
      todayRevenue,
      todayOrdersCount: todayOrders.length,
      pendingOrdersCount: pendingOrders,
      lowStockAlertsCount: lowStockProducts,
    });
  } catch (err) {
    console.error('Get dashboard summary error:', err);
    return error(res, 500, 'Error retrieving summary', 'SUMMARY_ERROR');
  }
};

// Get Sales Trend
const getSalesTrend = async (req, res) => {
  try {
    const businessId = req.user.businessId;
    const { period = 'day' } = req.query; // day, week, month

    const dateFormat = {
      day: '%Y-%m-%d',
      week: '%Y-W%V',
      month: '%Y-%m',
    }[period] || '%Y-%m-%d';

    const salesData = await Order.aggregate([
      {
        $match: {
          business: new mongoose.Types.ObjectId(businessId),
          status: { $ne: 'cancelled' },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: dateFormat,
              date: '$createdAt',
            },
          },
          totalRevenue: { $sum: '$totalAmount' },
          ordersCount: { $sum: 1 },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    return success(res, 200, 'Sales trend retrieved', {
      period,
      data: salesData,
    });
  } catch (err) {
    console.error('Get sales trend error:', err);
    return error(res, 500, 'Error retrieving sales trend', 'TREND_ERROR');
  }
};

// Get Top Products
const getTopProducts = async (req, res) => {
  try {
    const businessId = req.user.businessId;
    const { limit = 10 } = req.query;

    const topProducts = await Order.aggregate([
      {
        $match: {
          business: new mongoose.Types.ObjectId(businessId),
          status: { $ne: 'cancelled' },
        },
      },
      {
        $unwind: '$items',
      },
      {
        $group: {
          _id: '$items.product',
          totalQuantity: { $sum: '$items.quantity' },
          totalRevenue: { $sum: '$items.total' },
          salesCount: { $sum: 1 },
        },
      },
      {
        $sort: { totalRevenue: -1 },
      },
      {
        $limit: parseInt(limit),
      },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'product',
        },
      },
      {
        $unwind: '$product',
      },
      {
        $project: {
          productId: '$_id',
          productName: '$product.name',
          productImage: { $arrayElemAt: ['$product.images', 0] },
          price: '$product.price',
          totalQuantity: 1,
          totalRevenue: 1,
          salesCount: 1,
        },
      },
    ]);

    return success(res, 200, 'Top products retrieved', {
      products: topProducts,
      count: topProducts.length,
    });
  } catch (err) {
    console.error('Get top products error:', err);
    return error(res, 500, 'Error retrieving top products', 'TOP_PRODUCTS_ERROR');
  }
};

// Get Payment Breakdown
const getPaymentBreakdown = async (req, res) => {
  try {
    const businessId = req.user.businessId;

    const breakdown = await Order.aggregate([
      {
        $match: {
          business: new mongoose.Types.ObjectId(businessId),
          status: { $ne: 'cancelled' },
        },
      },
      {
        $group: {
          _id: '$paymentMethod',
          totalAmount: { $sum: '$totalAmount' },
          ordersCount: { $sum: 1 },
        },
      },
      {
        $sort: { totalAmount: -1 },
      },
    ]);

    return success(res, 200, 'Payment breakdown retrieved', {
      breakdown,
    });
  } catch (err) {
    console.error('Get payment breakdown error:', err);
    return error(res, 500, 'Error retrieving payment breakdown', 'PAYMENT_ERROR');
  }
};

// Get Customer Insights
const getCustomerInsights = async (req, res) => {
  try {
    const businessId = req.user.businessId;

    // Total unique customers
    const totalCustomers = await Order.distinct('customer', {
      business: businessId,
      status: { $ne: 'cancelled' },
    });

    // New customers (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const newCustomers = await Order.distinct('customer', {
      business: businessId,
      createdAt: { $gte: thirtyDaysAgo },
      status: { $ne: 'cancelled' },
    });

    // Returning customers (more than 1 order)
    const returningCustomers = await Order.aggregate([
      {
        $match: {
          business: new mongoose.Types.ObjectId(businessId),
          status: { $ne: 'cancelled' },
        },
      },
      {
        $group: {
          _id: '$customer',
          orderCount: { $sum: 1 },
        },
      },
      {
        $match: { orderCount: { $gt: 1 } },
      },
      {
        $count: 'total',
      },
    ]);

    return success(res, 200, 'Customer insights retrieved', {
      totalCustomers: totalCustomers.length,
      newCustomers: newCustomers.length,
      returningCustomers: returningCustomers[0]?.total || 0,
      oneTimeCustomers: totalCustomers.length - (returningCustomers[0]?.total || 0),
    });
  } catch (err) {
    console.error('Get customer insights error:', err);
    return error(res, 500, 'Error retrieving customer insights', 'CUSTOMER_INSIGHTS_ERROR');
  }
};

module.exports = {
  getDashboardSummary,
  getSalesTrend,
  getTopProducts,
  getPaymentBreakdown,
  getCustomerInsights,
};
