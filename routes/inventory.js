const express = require('express');
const router = express.Router();
const {
  getInventory,
  getInventoryItem,
  createInventoryItem,
  updateInventoryItem,
  adjustInventoryStock,
  deleteInventoryItem
} = require('../controllers/inventoryController');
const { protect } = require('../middleware/auth');

// All inventory routes are protected by auth check
router.use(protect);

router
  .route('/')
  .get(getInventory)
  .post(createInventoryItem);

router
  .route('/:id')
  .get(getInventoryItem)
  .put(updateInventoryItem)
  .delete(deleteInventoryItem);

// Stock adjustment endpoint (in/out)
router.patch('/:id/adjust', adjustInventoryStock);

module.exports = router;
