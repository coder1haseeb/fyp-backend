const bcryptjs = require('bcryptjs');
const Customer = require('../models/Customer');
const BusinessOwner = require('../models/BusinessOwner');
const Admin = require('../models/Admin');
const Business = require('../models/Business');
const Category = require('../models/Category');
const { success, error } = require('../utils/ApiResponse');
const generateToken = require('../utils/generateToken');
const generateOTP = require('../utils/generateOTP');
const sendOTPEmail = require('../utils/sendEmail');
const { parseStoreLocation } = require('../utils/storeLocation');

// Register Customer
const registerCustomer = async (req, res) => {
  try {
    const { fullName, email, password, phone, city } = req.body;

    // Check if customer already exists
    const existingCustomer = await Customer.findOne({ email });
    if (existingCustomer) {
      return error(res, 409, 'Email already registered', 'EMAIL_EXISTS');
    }

    // Hash password
    const hashedPassword = await bcryptjs.hash(password, 12);

    // Generate OTP
    const { otp, expiry } = generateOTP();

    // Create customer
    const customer = new Customer({
      fullName,
      email,
      passwordHash: hashedPassword,
      phone,
      city,
      otpCode: otp,
      otpExpiry: expiry,
      emailVerified: false,
    });

    await customer.save();

    // Send OTP email
    try {
      await sendOTPEmail(email, otp, 'verify');
    } catch (emailError) {
      console.error('Failed to send OTP email:', emailError);
    }

    return success(res, 201, 'Customer registered. Check your email for OTP.', {
      userId: customer._id,
      email: customer.email,
      message: 'Verify your email with OTP',
    });
  } catch (err) {
    console.error('Register customer error:', err);
    return error(res, 500, 'Error registering customer', 'REGISTER_ERROR');
  }
};

// Register Business Owner & Store
const registerBusiness = async (req, res) => {
  try {
    const location = parseStoreLocation(req.body.location);
    if (!location) return error(res, 400, 'Confirm the store location on the map', 'INVALID_LOCATION');
    const {
      fullName,
      email,
      password,
      phone,
      storeName,
      categoryId,
      description,
      address,
      city,
      storePhone,
    } = req.body;

    const category = await Category.findOne({ _id: categoryId, isActive: true });
    if (!category) return error(res, 400, 'Select an active store category', 'INVALID_CATEGORY');
    const logo = req.body.logo;
    if (logo !== undefined && (typeof logo !== 'string' || logo.length > 3 * 1024 * 1024 ||
        !/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(logo))) {
      return error(res, 400, 'Logo must be a JPG, PNG, or WebP image smaller than 2 MB', 'INVALID_LOGO');
    }

    // Check if business owner already exists
    const existingOwner = await BusinessOwner.findOne({ email });
    if (existingOwner) {
      return error(res, 409, 'Email already registered', 'EMAIL_EXISTS');
    }

    // Hash password
    const hashedPassword = await bcryptjs.hash(password, 12);

    // Create business owner
    const owner = new BusinessOwner({
      fullName,
      email,
      passwordHash: hashedPassword,
      phone,
    });

    await owner.save();

    // Create business with base64 logo from request body
    const business = new Business({
      storeName,
      category: categoryId,
      description,
      address,
      city,
      location,
      phone: storePhone,
      logo: logo || '',
      owner: owner._id,
      approvalStatus: 'pending',
    });

    await business.save();

    // Link business to owner
    owner.businesses.push(business._id);
    await owner.save();

    return success(res, 201, 'Business registered successfully. Awaiting approval.', {
      businessOwnerId: owner._id,
      businessId: business._id,
      approvalStatus: business.approvalStatus,
    });
  } catch (err) {
    console.error('Register business error:', err);
    return error(res, 500, 'Error registering business', 'REGISTER_ERROR');
  }
};

// Login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Try to find in Customer or BusinessOwner
    const customer = await Customer.findOne({ email }).select('+passwordHash');
    const businessOwner = await BusinessOwner.findOne({ email }).select('+passwordHash');

    let user = customer || businessOwner;

    if (!user) {
      return error(res, 401, 'Invalid email or password', 'INVALID_CREDENTIALS');
    }

    // Verify password
    const isPasswordValid = await bcryptjs.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return error(res, 401, 'Invalid email or password', 'INVALID_CREDENTIALS');
    }

    // Check if customer is verified
    if (customer && !customer.emailVerified) {
      return error(res, 403, 'Please verify your email first', 'EMAIL_NOT_VERIFIED');
    }

    // Check if user is active
    if (!user.isActive) {
      return error(res, 403, 'Your account has been suspended', 'ACCOUNT_SUSPENDED');
    }

    // For business owner, find their business (any approval status)
    if (businessOwner) {
      const business = await Business.findOne({
        owner: user._id,
      }).populate('category', 'name icon');

      if (!business) {
        return error(res, 403, 'No business found for this account', 'BUSINESS_NOT_FOUND');
      }

      const token = generateToken(user._id, 'business_admin', business._id);
      return success(res, 200, 'Login successful', {
        token,
        user: {
          id: user._id,
          fullName: user.fullName,
          email: user.email,
          role: 'business_admin',
          businessId: business._id,
        },
        business,
      });
    }

    // Customer login
    const token = generateToken(user._id, 'customer');
    return success(res, 200, 'Login successful', {
      token,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: 'customer',
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    return error(res, 500, 'Error logging in', 'LOGIN_ERROR');
  }
};

// Admin Login
const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    const admin = await Admin.findOne({ email }).select('+passwordHash');

    if (!admin) {
      return error(res, 401, 'Invalid email or password', 'INVALID_CREDENTIALS');
    }

    const isPasswordValid = await bcryptjs.compare(password, admin.passwordHash);
    if (!isPasswordValid) {
      return error(res, 401, 'Invalid email or password', 'INVALID_CREDENTIALS');
    }

    const token = generateToken(admin._id, 'super_admin');
    return success(res, 200, 'Admin login successful', {
      token,
      user: {
        id: admin._id,
        fullName: admin.fullName,
        email: admin.email,
        role: 'super_admin',
      },
    });
  } catch (err) {
    console.error('Admin login error:', err);
    return error(res, 500, 'Error logging in', 'LOGIN_ERROR');
  }
};

// Verify Email with OTP
const verifyEmail = async (req, res) => {
  try {
    const { email, otp } = req.body;

    const customer = await Customer.findOne({ email }).select('+otpCode +otpExpiry');

    if (!customer) {
      return error(res, 404, 'Customer not found', 'NOT_FOUND');
    }

    if (customer.otpCode !== otp) {
      return error(res, 400, 'Invalid OTP', 'INVALID_OTP');
    }

    if (new Date() > customer.otpExpiry) {
      return error(res, 400, 'OTP has expired', 'OTP_EXPIRED');
    }

    customer.emailVerified = true;
    customer.otpCode = null;
    customer.otpExpiry = null;
    await customer.save();

    return success(res, 200, 'Email verified successfully', {
      token: generateToken(customer._id, 'customer'),
      user: {
        id: customer._id,
        fullName: customer.fullName,
        email: customer.email,
        role: 'customer',
      },
    });
  } catch (err) {
    console.error('Verify email error:', err);
    return error(res, 500, 'Error verifying email', 'VERIFY_ERROR');
  }
};

// Issue a fresh verification code for an unverified customer.
const resendVerificationCode = async (req, res) => {
  try {
    const { email } = req.body;
    const customer = await Customer.findOne({ email }).select('+otpCode +otpExpiry');
    if (!customer || customer.emailVerified) {
      return success(res, 200, 'If verification is pending, a code has been sent', {});
    }
    const { otp, expiry } = generateOTP();
    await sendOTPEmail(email, otp, 'verify');
    customer.otpCode = otp;
    customer.otpExpiry = expiry;
    await customer.save();
    return success(res, 200, 'Verification code sent', {});
  } catch (err) {
    console.error('Resend verification code error:', err);
    return error(res, 503, 'Could not send verification code. Please try again.', 'EMAIL_ERROR');
  }
};

// Forgot Password
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const customer = await Customer.findOne({ email });
    if (!customer) {
      // Don't reveal if email exists
      return success(res, 200, 'If email exists, OTP will be sent shortly', {});
    }

    const { otp, expiry } = generateOTP();
    customer.otpCode = otp;
    customer.otpExpiry = expiry;
    await customer.save();

    try {
      await sendOTPEmail(email, otp, 'reset');
    } catch (emailError) {
      console.error('Failed to send reset email:', emailError);
    }

    return success(res, 200, 'OTP sent to your email', {
      email,
    });
  } catch (err) {
    console.error('Forgot password error:', err);
    return error(res, 500, 'Error processing password reset', 'FORGOT_PASSWORD_ERROR');
  }
};

// Reset Password
const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    const customer = await Customer.findOne({ email }).select('+otpCode +otpExpiry');

    if (!customer) {
      return error(res, 404, 'Customer not found', 'NOT_FOUND');
    }

    if (customer.otpCode !== otp) {
      return error(res, 400, 'Invalid OTP', 'INVALID_OTP');
    }

    if (new Date() > customer.otpExpiry) {
      return error(res, 400, 'OTP has expired', 'OTP_EXPIRED');
    }

    const hashedPassword = await bcryptjs.hash(newPassword, 12);
    customer.passwordHash = hashedPassword;
    customer.otpCode = null;
    customer.otpExpiry = null;
    await customer.save();

    return success(res, 200, 'Password reset successfully', {
      message: 'You can now login with your new password',
    });
  } catch (err) {
    console.error('Reset password error:', err);
    return error(res, 500, 'Error resetting password', 'RESET_ERROR');
  }
};

// Logout
const logout = async (req, res) => {
  try {
    // Stateless JWT - client should delete token
    return success(res, 200, 'Logged out successfully', {
      message: 'Token deleted from client',
    });
  } catch (err) {
    console.error('Logout error:', err);
    return error(res, 500, 'Error logging out', 'LOGOUT_ERROR');
  }
};

module.exports = {
  registerCustomer,
  registerBusiness,
  login,
  adminLogin,
  verifyEmail,
  resendVerificationCode,
  forgotPassword,
  resetPassword,
  logout,
};
