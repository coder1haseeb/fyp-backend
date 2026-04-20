const Product = require('../models/Product');
const { success, error } = require('../utils/ApiResponse');

// Get Product by ID
const getProductById = async (req, res) => {
  try {
    const { productId } = req.params;

    const product = await Product.findById(productId)
      .populate('business', 'storeName logo city rating phone')
      .lean();

    if (!product || product.status !== 'active') {
      return error(res, 404, 'Product not found', 'NOT_FOUND');
    }

    return success(res, 200, 'Product retrieved', product);
  } catch (err) {
    console.error('Get product by ID error:', err);
    return error(res, 500, 'Error retrieving product', 'GET_PRODUCT_ERROR');
  }
};

module.exports = {
  getProductById,
};
