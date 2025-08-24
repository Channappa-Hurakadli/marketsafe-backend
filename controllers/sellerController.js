const Purchase = require('../models/Purchase');
const Dataset = require('../models/Dataset');

// @desc    Get stats for the logged-in seller
// @route   GET /api/seller/stats
// @access  Private (Sellers only)
const getSellerStats = async (req, res) => {
    try {
        const sellerId = req.user.id;

        // Requirement 3: Calculate total revenue
        const purchases = await Purchase.find({ seller: sellerId });
        const totalRevenue = purchases.reduce((acc, purchase) => acc + purchase.purchasePrice, 0);

        // You can add more stats here, like total datasets, total views, etc.
        const totalDatasets = await Dataset.countDocuments({ seller: sellerId });

        res.json({
            totalRevenue,
            totalDatasets,
        });

    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = { getSellerStats };
