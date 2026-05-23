const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Protect routes by validating JWT Bearer tokens
 */
const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];

      // Decode token to retrieve user ID
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'coldchain_erp_secret_key_2026');

      // Fetch user profile and append to request
      req.user = await User.findById(decoded.id).select('-password');
      
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Not authorized, user profile not found'
        });
      }

      next();
    } catch (error) {
      console.error('JWT verification error:', error.message);
      return res.status(401).json({
        success: false,
        message: 'Not authorized, token validation failed'
      });
    }
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized, no token provided'
    });
  }
};

/**
 * Limit route access to specified roles (e.g. Admin, Manager)
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Role '${req.user ? req.user.role : 'Guest'}' is not authorized to perform this action`
      });
    }
    next();
  };
};

module.exports = { protect, authorize };
