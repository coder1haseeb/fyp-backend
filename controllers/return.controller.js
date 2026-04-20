const Return = require('../models/Return');
const Order = require('../models/Order');
const { success, error } = require('../utils/ApiResponse');
const createNotification = require('../utils/createNotification');

// Helper: Generate Return ID
const generateReturnId = async () => {
  const count = await Return.countDocuments();
  const returnNumber = String(count + 1).padStart(5, '0');
  return `RET-${returnNumber}`;
};

// Create Return Request
const createReturn = async (req, res) => {
  try {
    const { orderId, productId, reason, description, images } = req.body;
    const customerId = req.user.userId;

    // Verify order belongs to customer and is delivered
    const order = await Order.findById(orderId);
    if (!order || order.customer.toString() !== customerId) {
      return error(res, 404, 'Order not found', 'NOT_FOUND');
    }

    if (order.status !== 'delivered') {
      return error(res, 400, 'Only delivered orders can be returned', 'INVALID_STATUS');
    }

    // Find the product in order items
    const orderItem = order.items.find((item) => item.product.toString() === productId);
    if (!orderItem) {
      return error(res, 404, 'Product not found in order', 'NOT_FOUND');
    }

    // Generate return ID
    const returnId = await generateReturnId();

    // Create return request
    const returnRequest = new Return({
      returnId,
      order: orderId,
      orderItem: {
        productId: orderItem.product,
        productName: orderItem.product.name,
        quantity: orderItem.quantity,
      },
      customer: customerId,
      business: order.business,
      reason,
      description,
      images: images || [],
      status: 'pending',
    });

    await returnRequest.save();

    // Notify business admin
    await createNotification(
      order.business,
      'BusinessOwner',
      'return',
      `Return Request - ${returnId}`,
      `Customer has requested a return for order ${order.orderId}. Reason: ${reason}`,
      {
        returnId: returnRequest._id,
        orderId: order._id,
      }
    );

    return success(res, 201, 'Return request created', returnRequest);
  } catch (err) {
    console.error('Create return error:', err);
    return error(res, 500, 'Error creating return request', 'CREATE_RETURN_ERROR');
  }
};

// Get Customer Returns
const getReturns = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const customerId = req.user.userId;
    const skip = (page - 1) * limit;

    const query = { customer: customerId };
    if (status) query.status = status;

    const total = await Return.countDocuments(query);
    const returns = await Return.find(query)
      .populate('order', 'orderId totalAmount')
      .populate('business', 'storeName')
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
    console.error('Get returns error:', err);
    return error(res, 500, 'Error retrieving returns', 'GET_RETURNS_ERROR');
  }
};

module.exports = {
  createReturn,
  getReturns,
};
