const express = require('express');
const router = express.Router();
const { purchaseSubscription } = require('../controllers/subscriptionController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.post('/subscribe', protect, authorize('seller'), purchaseSubscription);

module.exports = router;
