/**
 * Global Error Handler Middleware
 * Intercepts all application errors and converts them to consistent JSON API responses.
 */
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error stack for diagnostic purposes
  console.error('Error Intercepted:', {
    name: err.name,
    message: err.message,
    stack: err.stack
  });

  // Handle Mongoose Invalid ObjectId Cast
  if (err.name === 'CastError') {
    const message = `Resource not found with ID: ${err.value}`;
    return res.status(404).json({
      success: false,
      message
    });
  }

  // Handle Sequelize Unique Constraint and Validation Errors
  if (err.name === 'SequelizeValidationError' || err.name === 'SequelizeUniqueConstraintError') {
    const message = err.errors.map((e) => e.message).join(', ');
    return res.status(400).json({
      success: false,
      message
    });
  }

  // Handle Mongoose Duplicate Key Error (11000)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    const message = `Duplicate value entered for '${field}'. This value is already in use.`;
    return res.status(400).json({
      success: false,
      message
    });
  }

  // Handle Mongoose Validation Errors
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors)
      .map((val) => val.message)
      .join(', ');
    return res.status(400).json({
      success: false,
      message
    });
  }

  // Handle JWT Malformed Token Error
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid authorization token. Please log in again.'
    });
  }

  // Handle JWT Expired Token Error
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Authorization token has expired. Please log in again.'
    });
  }

  // Default server error fallback
  res.status(err.statusCode || 500).json({
    success: false,
    message: error.message || 'An unexpected server error occurred'
  });
};

module.exports = errorHandler;
