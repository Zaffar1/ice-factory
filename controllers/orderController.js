const Order = require('../models/Order');
const Customer = require('../models/Customer');
const Inventory = require('../models/Inventory');
const Payment = require('../models/Payment');

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
 * Helper to calculate the inventory decrement effect of an order
 */
const getOrderInventoryEffect = (order) => {
  if (!order || order.status !== 'Delivered') return 0;
  return order.qty;
};

/**
 * Helper to adjust inventory quantity for finished goods
 */
const adjustFinishedGoodsInventory = async (itemType, qtyChange) => {
  if (qtyChange === 0) return;

  const invItem = await Inventory.findOne({
    item: itemType,
    category: 'Finished Goods'
  });

  if (invItem) {
    invItem.qty = Math.max(0, invItem.qty + qtyChange);
    await invItem.save();
  }
};

/**
 * Helper to synchronize order paid status with collections receipts
 */
const syncOrderPaymentReceipt = async (order) => {
  if (!order) return;

  const orderId = order.orderId;
  const isPaid = order.payment === 'Paid';
  const isDelivered = order.status === 'Delivered';

  if (isPaid && isDelivered) {
    const existingPayment = await Payment.findOne({ note: `Auto-generated payment for Order #${orderId}` });
    if (!existingPayment) {
      await Payment.create({
        customer: order.customer,
        amount: order.amount,
        method: 'Cash',
        date: order.date || new Date(),
        note: `Auto-generated payment for Order #${orderId}`
      });
    }
  } else {
    const existingPayment = await Payment.findOne({ note: `Auto-generated payment for Order #${orderId}` });
    if (existingPayment) {
      await existingPayment.deleteOne();
    }
  }
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
      .populate('customer', 'id name customerId phone type')
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
    const orderData = { ...req.body, customerId: customerId };
    const order = new Order(orderData);
    await order.save();

    // Calculate customer balance adjustment
    const effect = getOrderBalanceEffect(order);
    if (effect > 0) {
      customer.balance += effect;
      await customer.save();
    }

    // Deduct quantity from finished goods inventory if order is delivered
    const stockEffect = getOrderInventoryEffect(order);
    if (stockEffect > 0) {
      await adjustFinishedGoodsInventory(order.type, -stockEffect);
    }

    // Sync collections payment receipt if order is Paid and Delivered
    await syncOrderPaymentReceipt(order);

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

    // Block editing if the order is already Delivered
    if (oldOrder.status === 'Delivered') {
      return res.status(400).json({
        success: false,
        message: 'Delivered orders cannot be modified'
      });
    }

    // Safely get old customer ID as string
    const oldCustomerId = oldOrder.customer ? oldOrder.customer.toString() : null;

    // Validate new customer if customer is changing
    const newCustomerId = req.body.customer || oldCustomerId;

    // Only check if there's a new customer ID (in case both are null)
    let newCustomer = null;
    if (newCustomerId) {
      newCustomer = await Customer.findById(newCustomerId);
      if (!newCustomer) {
        return res.status(404).json({
          success: false,
          message: 'Assigned customer not found'
        });
      }
    }

    // Build the updated order data to recalculate amount if qty/rate changed
    const updatedData = { ...req.body, customerId: newCustomerId };
    updatedData.customer = newCustomerId; // Ensure fallback is used if req.body.customer was empty
    const newQty = updatedData.qty !== undefined ? updatedData.qty : oldOrder.qty;
    const newRate = updatedData.rate !== undefined ? updatedData.rate : oldOrder.rate;
    updatedData.amount = newQty * newRate;

    // Calculate old & new effects using a plain object
    const tempOrder = { ...oldOrder.toObject(), ...updatedData };
    const oldEffect = getOrderBalanceEffect(oldOrder);
    const newEffect = getOrderBalanceEffect(tempOrder);

    // Save actual changes
    await Order.findByIdAndUpdate(req.params.id, updatedData, { runValidators: true });
    const updatedOrder = await Order.findById(req.params.id).populate('customer', 'name');

    // Adjust finished goods inventory dynamically
    const oldStockEffect = getOrderInventoryEffect(oldOrder);
    const newStockEffect = getOrderInventoryEffect(tempOrder);
    const typeChanged = oldOrder.type !== tempOrder.type;

    if (typeChanged) {
      if (oldStockEffect > 0) {
        await adjustFinishedGoodsInventory(oldOrder.type, oldStockEffect);
      }
      if (newStockEffect > 0) {
        await adjustFinishedGoodsInventory(tempOrder.type, -newStockEffect);
      }
    } else {
      const stockDiff = newStockEffect - oldStockEffect;
      if (stockDiff !== 0) {
        await adjustFinishedGoodsInventory(oldOrder.type, -stockDiff);
      }
    }

    // Adjust balances safely
    const newCustomerIdStr = newCustomerId ? newCustomerId.toString() : null;
    const customerChanged = oldCustomerId !== newCustomerIdStr;

    if (customerChanged) {
      // Revert old effect from old customer
      const oldCustomer = await Customer.findById(oldOrder.customer);
      if (oldCustomer && oldEffect > 0) {
        oldCustomer.balance -= oldEffect;
        await oldCustomer.save();
      }
      // Apply new effect to new customer
      if (newEffect > 0 && newCustomer) {
        newCustomer.balance += newEffect;
        await newCustomer.save();
      }
    } else {
      // Adjust balance of the same customer by the difference
      const diff = newEffect - oldEffect;
      if (diff !== 0 && newCustomer) {
        newCustomer.balance += diff;
        await newCustomer.save();
      }
    }

    // Sync collections payment receipt if order is Paid and Delivered
    await syncOrderPaymentReceipt(updatedOrder);

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

    // Restore finished goods stock back to inventory if order was delivered
    const stockEffect = getOrderInventoryEffect(order);
    if (stockEffect > 0) {
      await adjustFinishedGoodsInventory(order.type, stockEffect);
    }

    // Clean up any auto-generated payment receipt
    const existingPayment = await Payment.findOne({ note: `Auto-generated payment for Order #${order.orderId}` });
    if (existingPayment) {
      await existingPayment.deleteOne();
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
