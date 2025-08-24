const express = require('express');
const router = express.Router();
const { getSellerStats } = require('../controllers/sellerController');
const { protect, authorize } = require('../middleware/authMiddleware');

// @route   GET /api/seller/stats
// @desc    Get stats for the logged-in seller
// @access  Private (Sellers only)
router.get('/stats', protect, authorize('seller'), getSellerStats);

module.exports = router;
