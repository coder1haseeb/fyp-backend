const Business = require('../models/Business');
const Product = require('../models/Product');
const { success, error } = require('../utils/ApiResponse');

// Get All Stores
const getStores = async (req, res) => {
  try {
    const { city, category, rating, page = 1, limit = 10, search } = req.query;
    const skip = (page - 1) * limit;

    const query = {
      approvalStatus: 'approved',
      isActive: true,
    };

    if (city) query.city = city;
    if (category) query.category = category;
    if (rating) query.rating = { $gte: parseFloat(rating) };
    if (search) {
      query.$or = [
        { storeName: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const total = await Business.countDocuments(query);
    const stores = await Business.find(query)
      .populate('category', 'name icon')
      .populate('owner', 'fullName email phone')
      .sort({ rating: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    return success(res, 200, 'Stores retrieved', {
      stores,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        total,
        limit: parseInt(limit),
      },
    });
  } catch (err) {
    console.error('Get stores error:', err);
    return error(res, 500, 'Error retrieving stores', 'GET_STORES_ERROR');
  }
};

// Get Store by ID
const getStoreById = async (req, res) => {
  try {
    const { storeId } = req.params;

    const store = await Business.findById(storeId)
      .populate('category', 'name icon')
      .populate('owner', 'fullName email phone')
      .lean();

    if (!store || store.approvalStatus !== 'approved' || !store.isActive) {
      return error(res, 404, 'Store not found', 'NOT_FOUND');
    }

    return success(res, 200, 'Store retrieved', store);
  } catch (err) {
    console.error('Get store by ID error:', err);
    return error(res, 500, 'Error retrieving store', 'GET_STORE_ERROR');
  }
};

// Get Store Products
const getStoreProducts = async (req, res) => {
  try {
    const { storeId } = req.params;
    const { category, page = 1, limit = 10, search } = req.query;
    const skip = (page - 1) * limit;

    const query = {
      business: storeId,
      status: 'active',
    };

    if (category) query.category = category;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const total = await Product.countDocuments(query);
    const products = await Product.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    return success(res, 200, 'Store products retrieved', {
      products,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        total,
        limit: parseInt(limit),
      },
    });
  } catch (err) {
    console.error('Get store products error:', err);
    return error(res, 500, 'Error retrieving products', 'GET_PRODUCTS_ERROR');
  }
};

module.exports = {
  getStores,
  getStoreById,
  getStoreProducts,
};
