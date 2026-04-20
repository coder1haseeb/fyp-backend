const Customer = require('../models/Customer');
const BusinessOwner = require('../models/BusinessOwner');
const Business = require('../models/Business');
const Order = require('../models/Order');
const { success, error } = require('../utils/ApiResponse');

// Get Growth Stats
const getGrowthStats = async (req, res) => {
  try {
    const monthlyStats = await Order.aggregate([
      {
        $facet: {
          orders: [
            {
              $group: {
                _id: {
                  $dateToString: {
                    format: '%Y-%m',
                    date: '$createdAt',
                  },
                },
                count: { $sum: 1 },
                revenue: { $sum: '$totalAmount' },
              },
            },
            { $sort: { _id: 1 } },
          ],
          users: [
            {
              $group: {
                _id: {
                  $dateToString: {
                    format: '%Y-%m',
                    date: '$createdAt',
                  },
                },
                uniqueCustomers: { $addToSet: '$customer' },
              },
            },
            {
              $project: {
                _id: 1,
                count: { $size: '$uniqueCustomers' },
              },
            },
            { $sort: { _id: 1 } },
          ],
        },
      },
    ]);

    const newBusinessesPerMonth = await Business.aggregate([
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m',
              date: '$createdAt',
            },
          },
          count: { $sum: 1 },
          approved: {
            $sum: {
              $cond: [{ $eq: ['$approvalStatus', 'approved'] }, 1, 0],
            },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return success(res, 200, 'Growth stats retrieved', {
      monthly: {
        orders: monthlyStats[0].orders,
        newCustomers: monthlyStats[0].users,
        newBusinesses: newBusinessesPerMonth,
      },
    });
  } catch (err) {
    console.error('Get growth stats error:', err);
    return error(res, 500, 'Error retrieving growth stats', 'GROWTH_ERROR');
  }
};

// Get Top Stores
const getTopStores = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const topStores = await Order.aggregate([
      {
        $match: { status: { $ne: 'cancelled' } },
      },
      {
        $group: {
          _id: '$business',
          ordersCount: { $sum: 1 },
          totalRevenue: { $sum: '$totalAmount' },
        },
      },
      {
        $sort: { ordersCount: -1 },
      },
      {
        $limit: parseInt(limit),
      },
      {
        $lookup: {
          from: 'businesses',
          localField: '_id',
          foreignField: '_id',
          as: 'business',
        },
      },
      {
        $unwind: '$business',
      },
      {
        $project: {
          businessId: '$_id',
          storeName: '$business.storeName',
          city: '$business.city',
          logo: '$business.logo',
          rating: '$business.rating',
          ordersCount: 1,
          totalRevenue: 1,
        },
      },
    ]);

    return success(res, 200, 'Top stores retrieved', {
      stores: topStores,
      count: topStores.length,
    });
  } catch (err) {
    console.error('Get top stores error:', err);
    return error(res, 500, 'Error retrieving top stores', 'TOP_STORES_ERROR');
  }
};

// Export Report
const exportReport = async (req, res) => {
  try {
    const stats = await Order.aggregate([
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m',
              date: '$createdAt',
            },
          },
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: '$totalAmount' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const totalUsers = await Customer.countDocuments();
    const totalBusinesses = await Business.countDocuments({ approvalStatus: 'approved' });

    let csv = 'Platform Statistics Report\n\n';
    csv += `Generated: ${new Date().toISOString()}\n\n`;
    csv += `Total Users,${totalUsers}\n`;
    csv += `Active Businesses,${totalBusinesses}\n\n`;

    csv += 'Monthly Revenue Report\n';
    csv += 'Month,Total Orders,Revenue (PKR)\n';

    stats.forEach((stat) => {
      csv += `${stat._id},${stat.totalOrders},${stat.totalRevenue.toFixed(2)}\n`;
    });

    res.set('Content-Type', 'text/csv');
    res.set('Content-Disposition', 'attachment; filename="platform_report.csv"');
    return res.send(csv);
  } catch (err) {
    console.error('Export report error:', err);
    return error(res, 500, 'Error exporting report', 'EXPORT_ERROR');
  }
};

module.exports = {
  getGrowthStats,
  getTopStores,
  exportReport,
};
