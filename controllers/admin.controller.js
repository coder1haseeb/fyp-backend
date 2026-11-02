const Customer = require('../models/Customer');
const BusinessOwner = require('../models/BusinessOwner');
const Admin = require('../models/Admin');
const Business = require('../models/Business');
const Order = require('../models/Order');
const { success, error } = require('../utils/ApiResponse');
const createNotification = require('../utils/createNotification');
const sendOTPEmail = require('../utils/sendEmail');

// Get Dashboard
const getDashboard = async (req, res) => {
  try {
    const customerCount = await Customer.countDocuments();
    const businessOwnerCount = await BusinessOwner.countDocuments();
    const activeBusinesses = await Business.countDocuments({ approvalStatus: 'approved', isActive: true });
    const totalOrders = await Order.countDocuments();

    const totalRevenue = await Order.aggregate([
      {
        $match: { status: { $ne: 'cancelled' } },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$totalAmount' },
        },
      },
    ]);

    return success(res, 200, 'Dashboard retrieved', {
      totalCustomers: customerCount,
      totalBusinessOwners: businessOwnerCount,
      activeBusinesses,
      totalOrders,
      totalRevenue: totalRevenue[0]?.total || 0,
    });
  } catch (err) {
    console.error('Get dashboard error:', err);
    return error(res, 500, 'Error retrieving dashboard', 'DASHBOARD_ERROR');
  }
};

// Get Businesses (for review)
const getBusinesses = async (req, res) => {
  try {
    const { approvalStatus, page = 1, limit = 10, search } = req.query;
    const skip = (page - 1) * limit;

    const query = {};
    if (approvalStatus) query.approvalStatus = approvalStatus;
    if (search) {
      query.$or = [{ storeName: { $regex: search, $options: 'i' } }];
    }

    const total = await Business.countDocuments(query);
    const businesses = await Business.find(query)
      .populate('owner', 'fullName email phone')
      .populate('category', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    return success(res, 200, 'Businesses retrieved', {
      businesses,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        total,
        limit: parseInt(limit),
      },
    });
  } catch (err) {
    console.error('Get businesses error:', err);
    return error(res, 500, 'Error retrieving businesses', 'GET_BUSINESSES_ERROR');
  }
};

// Get Business by ID
const getBusinessById = async (req, res) => {
  try {
    const { businessId } = req.params;

    const business = await Business.findById(businessId)
      .populate('owner', 'fullName email phone')
      .populate('category', 'name icon');

    if (!business) {
      return error(res, 404, 'Business not found', 'NOT_FOUND');
    }

    return success(res, 200, 'Business retrieved', business);
  } catch (err) {
    console.error('Get business error:', err);
    return error(res, 500, 'Error retrieving business', 'GET_BUSINESS_ERROR');
  }
};

// Approve or Reject Business
const decideOnBusiness = async (req, res) => {
  try {
    const { businessId } = req.params;
    const { decision, rejectionReason } = req.body;

    if (!['approved', 'rejected'].includes(decision)) {
      return error(res, 400, 'Invalid decision', 'INVALID_DECISION');
    }

    const business = await Business.findById(businessId);

    if (!business) {
      return error(res, 404, 'Business not found', 'NOT_FOUND');
    }

    business.approvalStatus = decision;
    if (decision === 'approved') {
      business.isActive = true;
    } else if (decision === 'rejected') {
      business.rejectionReason = rejectionReason || '';
    }

    await business.save();

    // Notify business owner
    const owner = await BusinessOwner.findById(business.owner);
    const message =
      decision === 'approved'
        ? `Your store "${business.storeName}" has been approved! You can now start accepting orders.`
        : `Your store "${business.storeName}" application was rejected. Reason: ${rejectionReason}`;

    await createNotification(
      business.owner,
      'BusinessOwner',
      'approval',
      `Store ${decision.toUpperCase()} - ${business.storeName}`,
      message,
      {
        businessId: business._id,
        decision,
      }
    );

    return success(res, 200, `Business ${decision}`, business);
  } catch (err) {
    console.error('Decide on business error:', err);
    return error(res, 500, 'Error processing decision', 'DECISION_ERROR');
  }
};

// Get Users
const getUsers = async (req, res) => {
  try {
    const { role, status, page = 1, limit = 10, search } = req.query;
    const skip = (page - 1) * limit;

    let query = {};
    if (status === 'active') query.isActive = true;
    if (status === 'suspended') query.isActive = false;

    let users = [];
    let total = 0;

    if (!role || role === 'customer') {
      const term = String(search || '').slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchQuery = term ? { ...query, $or: [{ fullName: { $regex: term, $options: 'i' } }, { email: { $regex: term, $options: 'i' } }] } : query;
      const customers = await Customer.find(searchQuery)
        .select('-passwordHash -otpCode -otpExpiry')
        .sort({ createdAt: -1 })
        .lean();

      users = users.concat(customers.map((c) => ({ ...c, role: 'customer' })));
    }

    if (!role || role === 'business_admin') {
      const term = String(search || '').slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchQuery = term ? { ...query, $or: [{ fullName: { $regex: term, $options: 'i' } }, { email: { $regex: term, $options: 'i' } }] } : query;
      const owners = await BusinessOwner.find(searchQuery)
        .select('-passwordHash')
        .sort({ createdAt: -1 })
        .lean();

      users = users.concat(owners.map((o) => ({ ...o, role: 'business_admin' })));
    }

    total = users.length;
    const paginatedUsers = users.slice(skip, skip + parseInt(limit));

    return success(res, 200, 'Users retrieved', {
      users: paginatedUsers,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        total,
        limit: parseInt(limit),
      },
    });
  } catch (err) {
    console.error('Get users error:', err);
    return error(res, 500, 'Error retrieving users', 'GET_USERS_ERROR');
  }
};

// Suspend User
const suspendUser = async (req, res) => {
  try {
    const { userId } = req.params;

    let user = await Customer.findByIdAndUpdate(userId, { isActive: false }, { new: true });

    if (!user) {
      user = await BusinessOwner.findByIdAndUpdate(userId, { isActive: false }, { new: true });
    }

    if (!user) {
      return error(res, 404, 'User not found', 'NOT_FOUND');
    }

    return success(res, 200, 'User suspended', {
      userId: user._id,
      isActive: user.isActive,
    });
  } catch (err) {
    console.error('Suspend user error:', err);
    return error(res, 500, 'Error suspending user', 'SUSPEND_ERROR');
  }
};

// Activate User
const activateUser = async (req, res) => {
  try {
    const { userId } = req.params;

    let user = await Customer.findByIdAndUpdate(userId, { isActive: true }, { new: true });

    if (!user) {
      user = await BusinessOwner.findByIdAndUpdate(userId, { isActive: true }, { new: true });
    }

    if (!user) {
      return error(res, 404, 'User not found', 'NOT_FOUND');
    }

    return success(res, 200, 'User activated', {
      userId: user._id,
      isActive: user.isActive,
    });
  } catch (err) {
    console.error('Activate user error:', err);
    return error(res, 500, 'Error activating user', 'ACTIVATE_ERROR');
  }
};

// Updates use explicit fields so roles, credentials and ownership cannot be changed.
const mutationError = (res, err) => {
  if (err.code === 11000) return error(res, 409, 'Email already in use', 'DUPLICATE_EMAIL');
  if (err.name === 'ValidationError' || err.name === 'CastError') return error(res, 400, 'Invalid record details', 'INVALID_DETAILS');
  console.error('Admin mutation failed:', err);
  return error(res, 500, 'Could not save changes', 'ADMIN_MUTATION_ERROR');
};

const updateUser = async (req, res) => {
  try {
    const user = await Customer.findById(req.params.userId) || await BusinessOwner.findById(req.params.userId);
    if (!user) return error(res, 404, 'User not found', 'NOT_FOUND');
    for (const field of ['fullName', 'phone', ...(user.role === 'customer' ? ['city'] : [])]) {
      if (req.body[field] !== undefined) user[field] = req.body[field];
    }
    if (req.body.email !== undefined && req.body.email !== user.email) {
      user.email = req.body.email;
      if (user.role === 'customer') { user.emailVerified = false; user.otpCode = undefined; user.otpExpiry = undefined; }
    }
    await user.save();
    return success(res, 200, 'User updated', { userId: user._id });
  } catch (err) { return mutationError(res, err); }
};

const updateBusiness = async (req, res) => {
  try {
    const business = await Business.findById(req.params.businessId);
    if (!business) return error(res, 404, 'Store not found', 'NOT_FOUND');
    if (req.body.isActive === true && business.approvalStatus !== 'approved') return error(res, 400, 'Approve this store before activating it', 'NOT_APPROVED');
    for (const field of ['storeName', 'description', 'address', 'city', 'phone', 'isActive']) {
      if (req.body[field] !== undefined) business[field] = req.body[field];
    }
    await business.save();
    return success(res, 200, 'Store updated', { businessId: business._id });
  } catch (err) { return mutationError(res, err); }
};

const deleteBusiness = async (req, res) => {
  try {
    const business = await Business.findById(req.params.businessId);
    if (!business) return error(res, 404, 'Store not found', 'NOT_FOUND');
    const Product = require('../models/Product');
    if (await Order.exists({ business: business._id }) || await Product.exists({ business: business._id })) {
      return error(res, 409, 'This store has products or orders. Deactivate it instead to preserve these records.', 'STORE_IN_USE');
    }
    await BusinessOwner.updateOne({ _id: business.owner }, { $pull: { businesses: business._id } });
    await Business.deleteOne({ _id: business._id });
    return success(res, 200, 'Store deleted', {});
  } catch (err) { return mutationError(res, err); }
};

const deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const customer = await Customer.findById(userId);
    const user = customer || await BusinessOwner.findById(userId);
    if (!user) return error(res, 404, 'User not found', 'NOT_FOUND');
    if (customer ? await Order.exists({ customer: userId }) : await Business.exists({ owner: userId })) {
      return error(res, 409, 'This user has linked orders or stores. Suspend the account instead.', 'USER_IN_USE');
    }
    await user.deleteOne();
    if (customer) await require('../models/Cart').deleteOne({ customer: userId });
    return success(res, 200, 'User deleted', {});
  } catch (err) { return mutationError(res, err); }
};

module.exports = {
  getDashboard,
  getBusinesses,
  getBusinessById,
  decideOnBusiness,
  getUsers,
  suspendUser,
  activateUser,
  deleteUser,
  updateUser,
  updateBusiness,
  deleteBusiness,
};
