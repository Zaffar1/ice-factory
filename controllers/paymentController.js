const Payment = require('../models/Payment');
const Customer = require('../models/Customer');

/**
 * @desc    Get all payments (with search, filter, and pagination)
 * @route   GET /api/payments
 * @access  Private
 */
exports.getPayments = async (req, res, next) => {
  try {
    let query = {};
    const { search, method, page = 1, limit = 10 } = req.query;

    // Search query: search by paymentId or customer name
    if (search) {
      const matchingCustomers = await Customer.find({
        name: { $regex: search, $options: 'i' }
      }).select('_id');
      const customerIds = matchingCustomers.map((c) => c._id);

      query.$or = [
        { paymentId: { $regex: search, $options: 'i' } },
        { customer: { $in: customerIds } }
      ];
    }

    // Direct filters
    if (method) {
      query.method = method;
    }

    // Pagination setup
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const total = await Payment.countDocuments(query);
    const payments = await Payment.find(query)
      .populate('customer', 'name customerId phone type')
      .sort({ date: -1, createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const pages = Math.ceil(total / limitNum);

    res.status(200).json({
      success: true,
      data: payments,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Record a new payment & reduce customer balance
 * @route   POST /api/payments
 * @access  Private
 */
exports.createPayment = async (req, res, next) => {
  try {
    const { customer: customerId, amount } = req.body;

    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    const payVal = parseFloat(amount);
    if (isNaN(payVal) || payVal <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Payment amount must be a positive number'
      });
    }

    // Create and save payment record
    const payment = new Payment(req.body);
    await payment.save();

    // Decrease the customer's outstanding balance
    customer.balance -= payVal;
    await customer.save();

    // Fetch saved payment with populated customer name
    const populatedPayment = await Payment.findById(payment._id).populate('customer', 'name');

    res.status(201).json({
      success: true,
      data: populatedPayment
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete payment record & revert customer balance increase
 * @route   DELETE /api/payments/:id
 * @access  Private
 */
exports.deletePayment = async (req, res, next) => {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment record not found'
      });
    }

    const customer = await Customer.findById(payment.customer);
    if (customer) {
      // Revert the payment amount back onto their outstanding balance
      customer.balance += payment.amount;
      await customer.save();
    }

    await payment.deleteOne();

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    next(error);
  }
};
