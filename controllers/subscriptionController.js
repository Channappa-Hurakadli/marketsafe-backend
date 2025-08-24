const User = require('../models/User');

// @desc    "Purchase" or update a seller's subscription
// @route   POST /api/subscriptions/subscribe
// @access  Private (Sellers only)
const purchaseSubscription = async (req, res) => {
    try {
        const { tier } = req.body;
        const sellerId = req.user.id;

        if (!['basic', 'pro', 'enterprise'].includes(tier)) {
            return res.status(400).json({ message: 'Invalid subscription tier.' });
        }

        const seller = await User.findById(sellerId);
        if (!seller) {
            return res.status(404).json({ message: 'Seller not found.' });
        }

        // In a real app, payment processing would happen here.
        // For now, we just update the user's subscription tier.
        seller.subscription.tier = tier;
        // Reset upload count when a new plan is chosen
        seller.subscription.uploadCount = 0; 
        
        await seller.save();

        res.json({
            message: `Successfully subscribed to the ${tier} plan!`,
            user: {
                _id: seller._id,
                name: seller.name,
                email: seller.email,
                role: seller.role,
                subscription: seller.subscription,
            }
        });

    } catch (error) {
        res.status(500).json({ message: 'Server error during subscription.' });
    }
};

module.exports = { purchaseSubscription };
