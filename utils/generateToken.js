const jwt = require('jsonwebtoken');

const generateToken = (userId, role, businessId = null) => {
  const payload = {
    userId,
    role,
    businessId,
  };

  const token = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

  return token;
};

module.exports = generateToken;
