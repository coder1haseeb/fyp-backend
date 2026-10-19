const Product = require('../models/Product');
const Business = require('../models/Business');
const { success, error } = require('../utils/ApiResponse');

// Get Product by ID
const getProductById = async (req, res) => {
  try {
    const { productId } = req.params;

    const product = await Product.findById(productId)
      .populate('business', 'storeName logo city rating phone approvalStatus isActive')
      .lean();

    if (!product || product.status !== 'active' || !product.business ||
        product.business.approvalStatus !== 'approved' || !product.business.isActive) {
      return error(res, 404, 'Product not found', 'NOT_FOUND');
    }

    return success(res, 200, 'Product retrieved', product);
  } catch (err) {
    console.error('Get product by ID error:', err);
    return error(res, 500, 'Error retrieving product', 'GET_PRODUCT_ERROR');
  }
};

// Create Product (business owner only)
const createProduct = async (req, res) => {
  try {
    const { businessId } = req.params;
    const { name, description, price, category, stockQty, status, images } = req.body;

    // Verify business exists and belongs to user
    const business = await Business.findById(businessId);
    if (!business) {
      return error(res, 404, 'Business not found', 'NOT_FOUND');
    }

    // Check if user owns this business (can be extended based on your auth model)
    if (business.owner.toString() !== req.user.userId) {
      return error(res, 403, 'Not authorized to add products to this business', 'UNAUTHORIZED');
    }

    const product = new Product({
      name,
      description,
      price,
      category,
      stockQty,
      status: status || 'active',
      images: images || [],
      business: businessId,
    });

    await product.save();

    return success(res, 201, 'Product created successfully', product);
  } catch (err) {
    console.error('Create product error:', err);
    return error(res, 500, 'Error creating product', 'CREATE_PRODUCT_ERROR');
  }
};

// Get Products by Business
const getProductsByBusiness = async (req, res) => {
  try {
    const { businessId } = req.params;
    const { status, page = 1, limit = 10 } = req.query;
    const business = await Business.findById(businessId);
    if (!business) return error(res, 404, 'Business not found', 'NOT_FOUND');
    if (business.owner.toString() !== req.user.userId) {
      return error(res, 403, 'Not authorized to view these products', 'UNAUTHORIZED');
    }

    const query = { business: businessId };
    if (status) query.status = status;

    const skip = (page - 1) * limit;
    const products = await Product.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await Product.countDocuments(query);

    return success(res, 200, 'Products retrieved', {
      products,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('Get products by business error:', err);
    return error(res, 500, 'Error retrieving products', 'GET_PRODUCTS_ERROR');
  }
};

// Update Product (business owner only)
const updateProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    const { name, description, price, category, stockQty, status, images } = req.body;

    const product = await Product.findById(productId);
    if (!product) {
      return error(res, 404, 'Product not found', 'NOT_FOUND');
    }

    // Verify ownership through business
    const business = await Business.findById(product.business);
    if (business.owner.toString() !== req.user.userId) {
      return error(res, 403, 'Not authorized to update this product', 'UNAUTHORIZED');
    }

    // Update fields
    if (name) product.name = name;
    if (description) product.description = description;
    if (price) product.price = price;
    if (category) product.category = category;
    if (stockQty !== undefined) product.stockQty = stockQty;
    if (status) product.status = status;
    if (images) product.images = images;

    await product.save();

    return success(res, 200, 'Product updated successfully', product);
  } catch (err) {
    console.error('Update product error:', err);
    return error(res, 500, 'Error updating product', 'UPDATE_PRODUCT_ERROR');
  }
};

// Delete Product (business owner only)
const deleteProduct = async (req, res) => {
  try {
    const { productId } = req.params;

    const product = await Product.findById(productId);
    if (!product) {
      return error(res, 404, 'Product not found', 'NOT_FOUND');
    }

    // Verify ownership through business
    const business = await Business.findById(product.business);
    if (business.owner.toString() !== req.user.userId) {
      return error(res, 403, 'Not authorized to delete this product', 'UNAUTHORIZED');
    }

    await Product.findByIdAndDelete(productId);

    return success(res, 200, 'Product deleted successfully');
  } catch (err) {
    console.error('Delete product error:', err);
    return error(res, 500, 'Error deleting product', 'DELETE_PRODUCT_ERROR');
  }
};

// Get Product for Edit (business owner only)
const getProductForEdit = async (req, res) => {
  try {
    const { productId } = req.params;

    const product = await Product.findById(productId);
    if (!product) {
      return error(res, 404, 'Product not found', 'NOT_FOUND');
    }

    // Verify ownership through business
    const business = await Business.findById(product.business);
    if (business.owner.toString() !== req.user.userId) {
      return error(res, 403, 'Not authorized to view this product', 'UNAUTHORIZED');
    }

    return success(res, 200, 'Product retrieved', product);
  } catch (err) {
    console.error('Get product for edit error:', err);
    return error(res, 500, 'Error retrieving product', 'GET_PRODUCT_ERROR');
  }
};

module.exports = {
  getProductById,
  createProduct,
  getProductsByBusiness,
  updateProduct,
  deleteProduct,
  getProductForEdit,
  getPublicProducts,
};

// Get all public active products (for customer browsing)
async function getPublicProducts(req, res) {
  try {
    const { limit = 10, page = 1, search = '' } = req.query;
    const pageNumber = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (pageNumber - 1) * pageSize;

    const approvedBusinesses = await Business.find({ approvalStatus: 'approved', isActive: true }).distinct('_id');
    const query = { status: 'active', stockQty: { $gt: 0 }, business: { $in: approvedBusinesses } };
    const term = String(search).trim().slice(0, 80);
    if (term) {
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { name: { $regex: escaped, $options: 'i' } },
        { description: { $regex: escaped, $options: 'i' } },
        { category: { $regex: escaped, $options: 'i' } },
      ];
    }
    const products = await Product.find(query)
      .populate('business', 'storeName logo city')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .lean();

    const total = await Product.countDocuments(query);

    console.log(`[getPublicProducts] Found ${products.length} products (total: ${total})`);

    return success(res, 200, 'Products retrieved', {
      products,
      pagination: {
        total,
        page: pageNumber,
        limit: pageSize,
        pages: Math.ceil(total / pageSize),
      },
    });
  } catch (err) {
    console.error('Get public products error:', err);
    return error(res, 500, 'Error retrieving products', 'GET_PRODUCTS_ERROR');
  }
}
