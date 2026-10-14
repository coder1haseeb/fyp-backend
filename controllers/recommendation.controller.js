const mongoose = require('mongoose');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const Business = require('../models/Business');
const Interaction = require('../models/Interaction');
const { rankProducts, similarProducts } = require('../utils/recommendationEngine');
const { success, error } = require('../utils/ApiResponse');

const visibleCatalogue = async () => {
  const products = await Product.find({ status: 'active', stockQty: { $gt: 0 } })
    .sort({ createdAt: -1 }).limit(1000)
    .populate({ path: 'business', match: { approvalStatus: 'approved', isActive: true }, select: 'storeName city logo' })
    .lean();
  return products.filter(product => product.business);
};

const getRecommendations = async (req, res) => {
  try {
    const limit = Number(req.query.limit || 10);
    const [products, interactions, customer] = await Promise.all([
      visibleCatalogue(),
      Interaction.find({ createdAt: { $gte: new Date(Date.now() - 90 * 86400000) } })
        .sort({ createdAt: -1 }).limit(5000).lean(),
      Customer.findById(req.user.userId).select('city').lean(),
    ]);
    const ranked = rankProducts({ products, interactions, customerId: req.user.userId,
      customerCity: customer?.city || '', limit });
    return success(res, 200, 'Recommendations retrieved', { products: ranked, count: ranked.length });
  } catch (err) {
    console.error('Get recommendations error:', err);
    return error(res, 500, 'Error retrieving recommendations', 'REC_ERROR');
  }
};

const getSimilarProducts = async (req, res) => {
  try {
    const { productId } = req.params;
    if (!mongoose.isValidObjectId(productId)) return error(res, 404, 'Product not found', 'NOT_FOUND');
    const [source, products] = await Promise.all([
      Product.findById(productId).populate({ path: 'business', match: { approvalStatus: 'approved', isActive: true }, select: 'storeName city logo' }).lean(),
      visibleCatalogue(),
    ]);
    if (!source || source.status !== 'active' || !source.business) {
      return error(res, 404, 'Product not found', 'NOT_FOUND');
    }
    const ranked = similarProducts(products, source, Number(req.query.limit || 5));
    return success(res, 200, 'Similar products retrieved', { products: ranked, count: ranked.length });
  } catch (err) {
    console.error('Get similar products error:', err);
    return error(res, 500, 'Error retrieving similar products', 'SIMILAR_ERROR');
  }
};

const logInteraction = async (req, res) => {
  try {
    const { productId } = req.body;
    if (!mongoose.isValidObjectId(productId)) return error(res, 404, 'Product not found', 'NOT_FOUND');
    const product = await Product.findById(productId).select('status business');
    if (!product || product.status !== 'active') return error(res, 404, 'Product not found', 'NOT_FOUND');
    const visibleBusiness = await Business.exists({ _id: product.business, approvalStatus: 'approved', isActive: true });
    if (!visibleBusiness) return error(res, 404, 'Product not found', 'NOT_FOUND');
    const recentView = await Interaction.exists({ customer: req.user.userId, product: productId,
      interactionType: 'view', createdAt: { $gte: new Date(Date.now() - 5 * 60000) } });
    if (recentView) return success(res, 200, 'View already recorded', {});
    await Interaction.create({ customer: req.user.userId, product: productId, interactionType: 'view' });
    return success(res, 201, 'View recorded', {});
  } catch (err) {
    console.error('Log interaction error:', err);
    return error(res, 500, 'Error logging interaction', 'LOG_ERROR');
  }
};

module.exports = { getRecommendations, getSimilarProducts, logInteraction };
