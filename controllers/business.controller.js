const Business = require('../models/Business');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Return = require('../models/Return');
const { success, error } = require('../utils/ApiResponse');
const createNotification = require('../utils/createNotification');
const { parseStoreLocation } = require('../utils/storeLocation');

const validStoreImage = value => typeof value === 'string' && (
  value === '' || /^https?:\/\//i.test(value) ||
  (value.length <= 3 * 1024 * 1024 && /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value))
);

// Get Business Profile
const getBusinessProfile = async (req, res) => {
  try {
    const businessId = req.user.businessId;

    const business = await Business.findById(businessId)
      .populate('category', 'name icon')
      .populate('owner', 'fullName email phone');

    if (!business || business.owner._id.toString() !== req.user.userId) {
      return error(res, 404, 'Business not found', 'NOT_FOUND');
    }

    return success(res, 200, 'Business profile retrieved', business);
  } catch (err) {
    console.error('Get business profile error:', err);
    return error(res, 500, 'Error retrieving profile', 'GET_PROFILE_ERROR');
  }
};

// Update Business Profile
const updateBusinessProfile = async (req, res) => {
  try {
    const businessId = req.user.businessId;
    const { storeName, description, address, city, phone, logo, coverImage, operatingHours, location } = req.body;

    const business = await Business.findById(businessId);

    if (!business || business.owner.toString() !== req.user.userId) {
      return error(res, 404, 'Business not found', 'NOT_FOUND');
    }

    if ((logo !== undefined && !validStoreImage(logo)) ||
        (coverImage !== undefined && !validStoreImage(coverImage))) {
      return error(res, 400, 'Store images must be JPG, PNG, or WebP and smaller than 2 MB', 'INVALID_IMAGE');
    }

    if (location !== undefined) {
      const parsedLocation = parseStoreLocation(location);
      if (!parsedLocation) return error(res, 400, 'Choose a valid store location', 'INVALID_LOCATION');
      business.location = parsedLocation;
    }

    if (storeName) business.storeName = storeName;
    if (description) business.description = description;
    if (address) business.address = address;
    if (city) business.city = city;
    if (phone) business.phone = phone;
    if (logo !== undefined) business.logo = logo;
    if (coverImage !== undefined) business.coverImage = coverImage;
    if (operatingHours) business.operatingHours = new Map(Object.entries(operatingHours));

    await business.save();

    const updated = await Business.findById(businessId)
      .populate('category', 'name icon')
      .populate('owner', 'fullName email phone');

    return success(res, 200, 'Profile updated', updated);
  } catch (err) {
    console.error('Update business profile error:', err);
    return error(res, 500, 'Error updating profile', 'UPDATE_PROFILE_ERROR');
  }
};

// Get Products
const getProducts = async (req, res) => {
  try {
    const businessId = req.user.businessId;
    const { category, status, page = 1, limit = 10, search } = req.query;
    const skip = (page - 1) * limit;

    const query = { business: businessId };
    if (category) query.category = category;
    if (status) query.status = status;
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

    return success(res, 200, 'Products retrieved', {
      products,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        total,
        limit: parseInt(limit),
      },
    });
  } catch (err) {
    console.error('Get products error:', err);
    return error(res, 500, 'Error retrieving products', 'GET_PRODUCTS_ERROR');
  }
};

// Add Product
const addProduct = async (req, res) => {
  try {
    const businessId = req.user.businessId;
    const { name, description, price, category, images, stockQty } = req.body;

    const product = new Product({
      name,
      description,
      price: parseFloat(price),
      category,
      images: images || [],
      stockQty: parseInt(stockQty) || 0,
      status: 'active',
      business: businessId,
    });

    await product.save();

    return success(res, 201, 'Product added', product);
  } catch (err) {
    console.error('Add product error:', err);
    return error(res, 500, 'Error adding product', 'ADD_PRODUCT_ERROR');
  }
};

// Update Product
const updateProduct = async (req, res) => {
  try {
    const businessId = req.user.businessId;
    const { productId } = req.params;
    const { name, description, price, category, images, stockQty, status } = req.body;

    const product = await Product.findById(productId);

    if (!product || product.business.toString() !== businessId) {
      return error(res, 404, 'Product not found', 'NOT_FOUND');
    }

    if (name) product.name = name;
    if (description) product.description = description;
    if (price) product.price = parseFloat(price);
    if (category) product.category = category;
    if (images) product.images = images;
    if (stockQty !== undefined) product.stockQty = parseInt(stockQty);
    if (status) product.status = status;

    await product.save();

    return success(res, 200, 'Product updated', product);
  } catch (err) {
    console.error('Update product error:', err);
    return error(res, 500, 'Error updating product', 'UPDATE_PRODUCT_ERROR');
  }
};

// Delete Product
const deleteProduct = async (req, res) => {
  try {
    const businessId = req.user.businessId;
    const { productId } = req.params;

    const product = await Product.findById(productId);

    if (!product || product.business.toString() !== businessId) {
      return error(res, 404, 'Product not found', 'NOT_FOUND');
    }

    await Product.deleteOne({ _id: productId });

    return success(res, 200, 'Product deleted', {});
  } catch (err) {
    console.error('Delete product error:', err);
    return error(res, 500, 'Error deleting product', 'DELETE_PRODUCT_ERROR');
  }
};

// Get Orders
const getOrders = async (req, res) => {
  try {
    const businessId = req.user.businessId;
    const { status, page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const query = { business: businessId };
    if (status) query.status = status;

    const total = await Order.countDocuments(query);
    const orders = await Order.find(query)
      .populate('customer', 'fullName phone email')
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
    const businessId = req.user.businessId;
    const { orderId } = req.params;

    const order = await Order.findById(orderId)
      .populate('customer', 'fullName phone email')
      .populate('items.product', 'name price images');

    if (!order || order.business.toString() !== businessId) {
      return error(res, 404, 'Order not found', 'NOT_FOUND');
    }

    return success(res, 200, 'Order retrieved', order);
  } catch (err) {
    console.error('Get order error:', err);
    return error(res, 500, 'Error retrieving order', 'GET_ORDER_ERROR');
  }
};

// Update Order Status
const updateOrderStatus = async (req, res) => {
  try {
    const businessId = req.user.businessId;
    const { orderId } = req.params;
    const { status } = req.body;

    const validStatuses = ['confirmed', 'processing', 'ready', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return error(res, 400, 'Invalid status', 'INVALID_STATUS');
    }

    const order = await Order.findById(orderId);

    if (!order || order.business.toString() !== businessId) {
      return error(res, 404, 'Order not found', 'NOT_FOUND');
    }

    order.status = status;
    order.timeline.push({
      status,
      timestamp: new Date(),
    });

    // For COD and pay_at_store, mark as paid when delivered
    if ((order.paymentMethod === 'cod' || order.paymentMethod === 'pay_at_store') && status === 'delivered') {
      order.paymentStatus = 'paid';
    }

    await order.save();

    // Notify customer
    await createNotification(
      order.customer,
      'Customer',
      'order_update',
      `Order Status Updated - ${order.orderId}`,
      `Your order status has been updated to ${status}`,
      {
        orderId: order._id,
        status,
      }
    );

    return success(res, 200, 'Order status updated', order);
  } catch (err) {
    console.error('Update order status error:', err);
    return error(res, 500, 'Error updating order status', 'UPDATE_STATUS_ERROR');
  }
};

// Get Business Returns
const getReturns = async (req, res) => {
  try {
    const businessId = req.user.businessId;
    const { status, page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const query = { business: businessId };
    if (status) query.status = status;

    const total = await Return.countDocuments(query);
    const returns = await Return.find(query)
      .populate('order', 'orderId totalAmount')
      .populate('customer', 'fullName email phone')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    return success(res, 200, 'Returns retrieved', {
      returns,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        total,
        limit: parseInt(limit),
      },
    });
  } catch (err) {
    console.error('Get business returns error:', err);
    return error(res, 500, 'Error retrieving returns', 'GET_RETURNS_ERROR');
  }
};

// Handle Return
const handleReturn = async (req, res) => {
  try {
    const businessId = req.user.businessId;
    const { returnId } = req.params;
    const { status, adminNote } = req.body;

    const validStatuses = ['approved', 'rejected'];
    if (!validStatuses.includes(status)) {
      return error(res, 400, 'Invalid status', 'INVALID_STATUS');
    }

    const returnRequest = await Return.findById(returnId);

    if (!returnRequest || returnRequest.business.toString() !== businessId) {
      return error(res, 404, 'Return request not found', 'NOT_FOUND');
    }

    returnRequest.status = status;
    returnRequest.adminNote = adminNote;
    await returnRequest.save();

    // Notify customer
    await createNotification(
      returnRequest.customer,
      'Customer',
      'return',
      `Return Request ${status.toUpperCase()} - ${returnRequest.returnId}`,
      `Your return request has been ${status}. ${adminNote ? `Note: ${adminNote}` : ''}`,
      {
        returnId: returnRequest._id,
        status,
      }
    );

    return success(res, 200, 'Return request handled', returnRequest);
  } catch (err) {
    console.error('Handle return error:', err);
    return error(res, 500, 'Error handling return', 'HANDLE_RETURN_ERROR');
  }
};

module.exports = {
  getBusinessProfile,
  updateBusinessProfile,
  getProducts,
  addProduct,
  updateProduct,
  deleteProduct,
  getOrders,
  getOrderById,
  updateOrderStatus,
  getReturns,
  handleReturn,
};
