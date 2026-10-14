const jwt = require('jsonwebtoken');
const Customer = require('../models/Customer');
const BusinessOwner = require('../models/BusinessOwner');
const Admin = require('../models/Admin');

const auth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided, authorization denied',
        error: 'NO_TOKEN',
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const Model = decoded.role === 'customer' ? Customer : decoded.role === 'business_admin' ? BusinessOwner : decoded.role === 'super_admin' ? Admin : null;
    if (!Model) return res.status(401).json({ success: false, message: 'Invalid session role', error: 'INVALID_TOKEN' });
    const account = await Model.findById(decoded.userId).select('isActive');
    if (!account) return res.status(401).json({ success: false, message: 'Account no longer exists', error: 'INVALID_TOKEN' });
    if (account.isActive === false) return res.status(403).json({ success: false, message: 'Your account has been suspended', error: 'ACCOUNT_SUSPENDED' });
    req.user = {
      userId: decoded.userId,
      role: decoded.role,
      businessId: decoded.businessId || null,
    };

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token has expired',
        error: 'TOKEN_EXPIRED',
      });
    }

    if (error.name === 'JsonWebTokenError' || error.name === 'NotBeforeError' || error.name === 'CastError') {
      return res.status(401).json({ success: false, message: 'Invalid token', error: 'INVALID_TOKEN' });
    }
    next(error);
  }
};

module.exports = auth;
