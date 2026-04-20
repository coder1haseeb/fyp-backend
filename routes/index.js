const express = require('express');
const router = express.Router();

// Import all route files
const authRoutes = require('./auth.routes');
const customerRoutes = require('./customer.routes');
const storeRoutes = require('./store.routes');
const productRoutes = require('./product.routes');
const cartRoutes = require('./cart.routes');
const orderRoutes = require('./order.routes');
const paymentRoutes = require('./payment.routes');
const returnRoutes = require('./return.routes');
const recommendationRoutes = require('./recommendation.routes');
const businessRoutes = require('./business.routes');
const inventoryRoutes = require('./inventory.routes');
const analyticsRoutes = require('./analytics.routes');
const adminRoutes = require('./admin.routes');
const categoryRoutes = require('./category.routes');
const platformReportsRoutes = require('./platformReports.routes');
const notificationRoutes = require('./notification.routes');
const invoiceRoutes = require('./invoice.routes');

// Mount all routes
router.use('/auth', authRoutes);
router.use('/customer', customerRoutes);
router.use('/stores', storeRoutes);
router.use('/products', productRoutes);
router.use('/cart', cartRoutes);
router.use('/orders', orderRoutes);
router.use('/payments', paymentRoutes);
router.use('/returns', returnRoutes);
router.use('/recommendations', recommendationRoutes);
router.use('/business', businessRoutes);
router.use('/business/inventory', inventoryRoutes);
router.use('/business/analytics', analyticsRoutes);
router.use('/admin', adminRoutes);
router.use('/categories', categoryRoutes);
router.use('/admin/reports', platformReportsRoutes);
router.use('/notifications', notificationRoutes);
router.use('/invoices', invoiceRoutes);

module.exports = router;
