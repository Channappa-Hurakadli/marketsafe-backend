const express = require('express');
const router = express.Router();
const { createPurchase, getMyPurchases } = require('../controllers/purchaseController');
const { protect, authorize } = require('../middleware/authMiddleware');

// @route   POST /api/purchases/dataset/:datasetId
// @desc    Purchase a dataset
// @access  Private (Buyers only)
router.post('/dataset/:datasetId', protect, authorize('buyer'), createPurchase);

// @route   GET /api/purchases/my-purchases
// @desc    Get all datasets purchased by the logged-in buyer
// @access  Private (Buyers only)
router.get('/my-purchases', protect, authorize('buyer'), getMyPurchases);

module.exports = router;
