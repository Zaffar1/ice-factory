const express = require('express');
const router = express.Router();
const {
  getProductions,
  createProduction,
  updateProduction,
  deleteProduction
} = require('../controllers/productionController');
const { protect } = require('../middleware/auth');

// All production routes require standard token verification
router.use(protect);

router
  .route('/')
  .get(getProductions)
  .post(createProduction);

router
  .route('/:id')
  .put(updateProduction)
  .delete(deleteProduction);

module.exports = router;
