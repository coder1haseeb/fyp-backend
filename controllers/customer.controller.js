const bcryptjs = require('bcryptjs');
const Customer = require('../models/Customer');
const Order = require('../models/Order');
const { success, error } = require('../utils/ApiResponse');

// Get Customer Profile
const getProfile = async (req, res) => {
  try {
    const customer = await Customer.findById(req.user.userId).select('-passwordHash -otpCode -otpExpiry').lean();

    if (!customer) {
      return error(res, 404, 'Customer not found', 'NOT_FOUND');
    }

    return success(res, 200, 'Profile retrieved', customer);
  } catch (err) {
    console.error('Get profile error:', err);
    return error(res, 500, 'Error retrieving profile', 'GET_PROFILE_ERROR');
  }
};

// Update Customer Profile
const updateProfile = async (req, res) => {
  try {
    const { fullName, phone, city, avatar } = req.body;

    const customer = await Customer.findById(req.user.userId);
    if (!customer) {
      return error(res, 404, 'Customer not found', 'NOT_FOUND');
    }

    if (fullName) customer.fullName = fullName;
    if (phone) customer.phone = phone;
    if (city) customer.city = city;
    if (avatar) customer.avatar = avatar;

    await customer.save();

    const updated = await Customer.findById(req.user.userId).select('-passwordHash -otpCode -otpExpiry').lean();

    return success(res, 200, 'Profile updated', updated);
  } catch (err) {
    console.error('Update profile error:', err);
    return error(res, 500, 'Error updating profile', 'UPDATE_PROFILE_ERROR');
  }
};

// Add Address
const addAddress = async (req, res) => {
  try {
    const { label, street, city, isDefault } = req.body;

    const customer = await Customer.findById(req.user.userId);
    if (!customer) {
      return error(res, 404, 'Customer not found', 'NOT_FOUND');
    }

    // If this is default, unset others
    if (isDefault) {
      customer.addresses.forEach((addr) => {
        addr.isDefault = false;
      });
    }

    customer.addresses.push({
      label,
      street,
      city,
      isDefault: isDefault || false,
    });

    await customer.save();

    return success(res, 201, 'Address added', customer.addresses);
  } catch (err) {
    console.error('Add address error:', err);
    return error(res, 500, 'Error adding address', 'ADD_ADDRESS_ERROR');
  }
};

// Update Address
const updateAddress = async (req, res) => {
  try {
    const { addressId } = req.params;
    const { label, street, city, isDefault } = req.body;

    const customer = await Customer.findById(req.user.userId);
    if (!customer) {
      return error(res, 404, 'Customer not found', 'NOT_FOUND');
    }

    const addressIndex = customer.addresses.findIndex((addr) => addr._id.toString() === addressId);
    if (addressIndex === -1) {
      return error(res, 404, 'Address not found', 'NOT_FOUND');
    }

    if (isDefault) {
      customer.addresses.forEach((addr) => {
        addr.isDefault = false;
      });
    }

    customer.addresses[addressIndex] = {
      ...customer.addresses[addressIndex],
      label,
      street,
      city,
      isDefault: isDefault !== undefined ? isDefault : customer.addresses[addressIndex].isDefault,
    };

    await customer.save();

    return success(res, 200, 'Address updated', customer.addresses);
  } catch (err) {
    console.error('Update address error:', err);
    return error(res, 500, 'Error updating address', 'UPDATE_ADDRESS_ERROR');
  }
};

// Delete Address
const deleteAddress = async (req, res) => {
  try {
    const { addressId } = req.params;

    const customer = await Customer.findByIdAndUpdate(
      req.user.userId,
      { $pull: { addresses: { _id: addressId } } },
      { new: true }
    );

    if (!customer) {
      return error(res, 404, 'Customer not found', 'NOT_FOUND');
    }

    return success(res, 200, 'Address deleted', customer.addresses);
  } catch (err) {
    console.error('Delete address error:', err);
    return error(res, 500, 'Error deleting address', 'DELETE_ADDRESS_ERROR');
  }
};

// Change Password
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const customer = await Customer.findById(req.user.userId).select('+passwordHash');
    if (!customer) {
      return error(res, 404, 'Customer not found', 'NOT_FOUND');
    }

    const isPasswordValid = await bcryptjs.compare(currentPassword, customer.passwordHash);
    if (!isPasswordValid) {
      return error(res, 401, 'Current password is incorrect', 'INVALID_PASSWORD');
    }

    const hashedPassword = await bcryptjs.hash(newPassword, 12);
    customer.passwordHash = hashedPassword;
    await customer.save();

    return success(res, 200, 'Password changed successfully', {});
  } catch (err) {
    console.error('Change password error:', err);
    return error(res, 500, 'Error changing password', 'CHANGE_PASSWORD_ERROR');
  }
};

// Get Customer Insights
const getInsights = async (req, res) => {
  try {
    const customerId = req.user.userId;

    const allOrders = await Order.find({
      customer: customerId,
      status: { $ne: 'cancelled' },
    }).lean();

    const totalOrders = allOrders.length;

    const thisMonth = new Date();
    thisMonth.setDate(1);

    const thisYear = new Date(new Date().getFullYear(), 0, 1);

    const thisMonthOrders = allOrders.filter(
      (order) => new Date(order.createdAt) >= thisMonth
    );
    const thisYearOrders = allOrders.filter(
      (order) => new Date(order.createdAt) >= thisYear
    );

    const thisMonthSpending = thisMonthOrders.reduce((sum, order) => sum + order.totalAmount, 0);
    const thisYearSpending = thisYearOrders.reduce((sum, order) => sum + order.totalAmount, 0);
    const totalSpending = allOrders.reduce((sum, order) => sum + order.totalAmount, 0);

    // Monthly breakdown
    const monthlyData = {};
    allOrders.forEach((order) => {
      const date = new Date(order.createdAt);
      const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyData[month]) {
        monthlyData[month] = { count: 0, amount: 0 };
      }
      monthlyData[month].count += 1;
      monthlyData[month].amount += order.totalAmount;
    });

    return success(res, 200, 'Customer insights retrieved', {
      totalOrders,
      totalSpending,
      thisMonth: {
        orders: thisMonthOrders.length,
        spending: thisMonthSpending,
      },
      thisYear: {
        orders: thisYearOrders.length,
        spending: thisYearSpending,
      },
      monthlyBreakdown: monthlyData,
    });
  } catch (err) {
    console.error('Get insights error:', err);
    return error(res, 500, 'Error retrieving insights', 'GET_INSIGHTS_ERROR');
  }
};

module.exports = {
  getProfile,
  updateProfile,
  addAddress,
  updateAddress,
  deleteAddress,
  changePassword,
  getInsights,
};
