const Production = require('../models/Production');
const Inventory = require('../models/Inventory');

/**
 * Helper to calculate the inventory increment effect of a production run
 */
const getProductionInventoryEffect = (prod) => {
  if (!prod || prod.status !== 'Completed') return 0;
  return Math.max(0, prod.produced - prod.damaged);
};

/**
 * Helper to adjust inventory quantity for a specific finished goods item
 */
const adjustFinishedGoodsInventory = async (itemType, qtyChange) => {
  if (qtyChange === 0) return;
  
  // Find matching Finished Goods item in inventory
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
 * @desc    Get all production logs (with search, filter, and pagination)
 * @route   GET /api/production
 * @access  Private
 */
exports.getProductions = async (req, res, next) => {
  try {
    let query = {};
    const { search, shift, date, page = 1, limit = 10 } = req.query;

    // Search query: search by operator or ice type
    if (search) {
      query.$or = [
        { operator: { $regex: search, $options: 'i' } },
        { type: { $regex: search, $options: 'i' } }
      ];
    }

    // Direct filters
    if (shift) {
      query.shift = shift;
    }

    // Date range filter for a specific day
    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setUTCHours(0, 0, 0, 0);

      const endOfDay = new Date(date);
      endOfDay.setUTCHours(23, 59, 59, 999);

      query.date = { $gte: startOfDay, $lte: endOfDay };
    }

    // Pagination setup
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const total = await Production.countDocuments(query);
    const productions = await Production.find(query)
      .sort({ date: -1, createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const pages = Math.ceil(total / limitNum);

    res.status(200).json({
      success: true,
      data: productions,
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
 * @desc    Create new production log
 * @route   POST /api/production
 * @access  Private
 */
exports.createProduction = async (req, res, next) => {
  try {
    const production = new Production(req.body);
    await production.save();

    // Adjust finished goods stock if marked completed immediately
    const effect = getProductionInventoryEffect(production);
    if (effect > 0) {
      await adjustFinishedGoodsInventory(production.type, effect);
    }

    res.status(201).json({
      success: true,
      data: production
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update production log & recalculate stock adjustments
 * @route   PUT /api/production/:id
 * @access  Private
 */
exports.updateProduction = async (req, res, next) => {
  try {
    const oldProduction = await Production.findById(req.params.id);
    if (!oldProduction) {
      return res.status(404).json({
        success: false,
        message: 'Production record not found'
      });
    }

    // Merge changes into a temporary object to calculate potential effects
    const tempProduction = new Production({
      ...oldProduction.toObject(),
      ...req.body
    });

    const oldEffect = getProductionInventoryEffect(oldProduction);
    const newEffect = getProductionInventoryEffect(tempProduction);

    const updatedProduction = await Production.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    // Dynamic stock adjustment based on whether the production type changed
    const typeChanged = oldProduction.type !== tempProduction.type;

    if (typeChanged) {
      // Revert stock adjustment from old category
      if (oldEffect > 0) {
        await adjustFinishedGoodsInventory(oldProduction.type, -oldEffect);
      }
      // Apply new stock adjustment to new category
      if (newEffect > 0) {
        await adjustFinishedGoodsInventory(tempProduction.type, newEffect);
      }
    } else {
      // Adjust stock of same category by net change difference
      const diff = newEffect - oldEffect;
      if (diff !== 0) {
        await adjustFinishedGoodsInventory(oldProduction.type, diff);
      }
    }

    res.status(200).json({
      success: true,
      data: updatedProduction
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete production log & revert stock impact
 * @route   DELETE /api/production/:id
 * @access  Private
 */
exports.deleteProduction = async (req, res, next) => {
  try {
    const production = await Production.findById(req.params.id);
    if (!production) {
      return res.status(404).json({
        success: false,
        message: 'Production record not found'
      });
    }

    // Reverse any inventory additions made by this production run
    const effect = getProductionInventoryEffect(production);
    if (effect > 0) {
      await adjustFinishedGoodsInventory(production.type, -effect);
    }

    await production.deleteOne();

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    next(error);
  }
};
