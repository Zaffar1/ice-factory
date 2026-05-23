const Order = require('../models/Order');
const Customer = require('../models/Customer');

/**
 * Helper to calculate the impact of an order on a customer's balance.
 * Returns order amount if payment is Pending or Credit and status is not Cancelled.
 */
const getOrderBalanceEffect = (order) => {
  if (!order) return 0;
  
  const isPendingOrCredit = ['Pending', 'Credit'].includes(order.payment);
  const isNotCancelled = order.status !== 'Cancelled';
  
  return (isPendingOrCredit && isNotCancelled) ? order.amount : 0;
};

/**
 * @desc    Get all orders (with search, filter, and pagination)
 * @route   GET /api/orders
 * @access  Private
 */
exports.getOrders = async (req, res, next) => {
  try {
    let query = {};
    const { search, status, payment, page = 1, limit = 10 } = req.query;

    // Search query: search by orderId or customer name
    if (search) {
      // Find customer IDs matching the search string
      const matchingCustomers = await Customer.find({
        name: { $regex: search, $options: 'i' }
      }).select('_id');
      const customerIds = matchingCustomers.map((c) => c._id);

      query.$or = [
        { orderId: { $regex: search, $options: 'i' } },
        { customer: { $in: customerIds } }
      ];
    }

    // Direct filters
    if (status) {
      query.status = status;
    }
    if (payment) {
      query.payment = payment;
    }

    // Pagination setup
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const total = await Order.countDocuments(query);
    const orders = await Order.find(query)
      .populate('customer', 'name customerId phone type')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const pages = Math.ceil(total / limitNum);

    res.status(200).json({
      success: true,
      data: orders,
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
 * @desc    Get single order
 * @route   GET /api/orders/:id
 * @access  Private
 */
exports.getOrder = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id).populate('customer', 'name customerId phone');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    res.status(200).json({
      success: true,
      data: order
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create new order & adjust customer balance
 * @route   POST /api/orders
 * @access  Private
 */
exports.createOrder = async (req, res, next) => {
  try {
    const { customer: customerId } = req.body;

    // Check if customer exists
    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    // Create the order (Mongoose pre-validate hook computes order.amount)
    const order = new Order(req.body);
    await order.save();

    // Calculate customer balance adjustment
    const effect = getOrderBalanceEffect(order);
    if (effect > 0) {
      customer.balance += effect;
      await customer.save();
    }

    // Fetch full saved order with populated customer details
    const populatedOrder = await Order.findById(order._id).populate('customer', 'name');

    res.status(201).json({
      success: true,
      data: populatedOrder
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update order & adjust customer balances dynamically
 * @route   PUT /api/orders/:id
 * @access  Private
 */
exports.updateOrder = async (req, res, next) => {
  try {
    const oldOrder = await Order.findById(req.params.id);
    if (!oldOrder) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Validate new customer if customer is changing
    const newCustomerId = req.body.customer || oldOrder.customer.toString();
    const newCustomer = await Customer.findById(newCustomerId);
    if (!newCustomer) {
      return res.status(404).json({
        success: false,
        message: 'Assigned customer not found'
      });
    }

    // Update fields & recalculate amount before saving
    // We temporary update a virtual mongoose instance to run validate & calculate amount
    const tempOrder = new Order({ ...oldOrder.toObject(), ...req.body });
    // Run pre-validate explicitly to update tempOrder.amount
    if (tempOrder.qty && tempOrder.rate) {
      tempOrder.amount = tempOrder.qty * tempOrder.rate;
    }

    // Calculate old & new effects
    const oldEffect = getOrderBalanceEffect(oldOrder);
    const newEffect = getOrderBalanceEffect(tempOrder);

    // Save actual changes
    const updatedOrder = await Order.findByIdAndUpdate(
      req.params.id,
      { ...req.body, amount: tempOrder.amount },
      { new: true, runValidators: true }
    ).populate('customer', 'name');

    // Adjust balances
    const customerChanged = oldOrder.customer.toString() !== newCustomerId;

    if (customerChanged) {
      // Revert old effect from old customer
      const oldCustomer = await Customer.findById(oldOrder.customer);
      if (oldCustomer && oldEffect > 0) {
        oldCustomer.balance -= oldEffect;
        await oldCustomer.save();
      }
      // Apply new effect to new customer
      if (newEffect > 0) {
        newCustomer.balance += newEffect;
        await newCustomer.save();
      }
    } else {
      // Adjust balance of the same customer by the difference
      const diff = newEffect - oldEffect;
      if (diff !== 0) {
        newCustomer.balance += diff;
        await newCustomer.save();
      }
    }

    res.status(200).json({
      success: true,
      data: updatedOrder
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete order & revert customer balance
 * @route   DELETE /api/orders/:id
 * @access  Private
 */
exports.deleteOrder = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Revert balance effect if applicable
    const effect = getOrderBalanceEffect(order);
    if (effect > 0) {
      const customer = await Customer.findById(order.customer);
      if (customer) {
        customer.balance -= effect;
        await customer.save();
      }
    }

    await order.deleteOne();

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    next(error);
  }
};
