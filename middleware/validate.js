/**
 * Request Validation Middleware Helper
 * Allows custom field validation checks before hitting the controller.
 * Note: Core validation is also managed by Mongoose schema constraints.
 */
const validateBody = (requiredFields) => {
  return (req, res, next) => {
    const missingFields = [];
    
    requiredFields.forEach((field) => {
      if (req.body[field] === undefined || req.body[field] === null || req.body[field] === '') {
        missingFields.push(field);
      }
    });

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Validation Error: Missing required fields: ${missingFields.join(', ')}`
      });
    }

    next();
  };
};

module.exports = {
  validateBody
};
