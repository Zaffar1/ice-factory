const Inventory = require('../models/Inventory');

/**
 * @desc    Get all inventory (with search, category, status filter, and pagination)
 * @route   GET /api/inventory
 * @access  Private
 */
exports.getInventory = async (req, res, next) => {
  try {
    let query = {};
    const { search, category, status, page = 1, limit = 10 } = req.query;

    // Search query: search by item name
    if (search) {
      query.item = { $regex: search, $options: 'i' };
    }

    // Category filter
    if (category) {
      query.category = category;
    }

    // Dynamic virtual-to-db query mapping using $expr operator
    if (status) {
      if (status === 'In Stock') {
        query.$expr = { $gte: ['$qty', '$minQty'] };
      } else if (status === 'Low Stock') {
        query.$expr = { $lt: ['$qty', '$minQty'] };
      }
    }

    // Pagination setup
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const total = await Inventory.countDocuments(query);
    const items = await Inventory.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const pages = Math.ceil(total / limitNum);

    res.status(200).json({
      success: true,
      data: items,
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
 * @desc    Get single inventory item
 * @route   GET /api/inventory/:id
 * @access  Private
 */
exports.getInventoryItem = async (req, res, next) => {
  try {
    const item = await Inventory.findById(req.params.id);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Inventory item not found'
      });
    }

    res.status(200).json({
      success: true,
      data: item
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create new inventory item
 * @route   POST /api/inventory
 * @access  Private
 */
exports.createInventoryItem = async (req, res, next) => {
  try {
    const item = await Inventory.create(req.body);

    res.status(201).json({
      success: true,
      data: item
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update inventory item
 * @route   PUT /api/inventory/:id
 * @access  Private
 */
exports.updateInventoryItem = async (req, res, next) => {
  try {
    let item = await Inventory.findById(req.params.id);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Inventory item not found'
      });
    }

    item = await Inventory.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    res.status(200).json({
      success: true,
      data: item
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Adjust inventory item quantities (inward / outward)
 * @route   PATCH /api/inventory/:id/adjust
 * @access  Private
 */
exports.adjustInventoryStock = async (req, res, next) => {
  try {
    const { adjustType, adjustQty } = req.body;

    if (!['add', 'remove'].includes(adjustType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid adjustment type. Must be "add" or "remove"'
      });
    }

    const qtyValue = parseFloat(adjustQty);
    if (isNaN(qtyValue) || qtyValue <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Adjustment quantity must be a positive number'
      });
    }

    const item = await Inventory.findById(req.params.id);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Inventory item not found'
      });
    }

    if (adjustType === 'add') {
      item.qty += qtyValue;
    } else {
      item.qty = Math.max(0, item.qty - qtyValue);
    }

    await item.save();

    res.status(200).json({
      success: true,
      data: item
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete inventory item
 * @route   DELETE /api/inventory/:id
 * @access  Private
 */
exports.deleteInventoryItem = async (req, res, next) => {
  try {
    const item = await Inventory.findById(req.params.id);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Inventory item not found'
      });
    }

    await item.deleteOne();

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    next(error);
  }
};
