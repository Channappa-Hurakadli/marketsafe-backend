const Purchase = require('../models/Purchase');
const Dataset = require('../models/Dataset');

// @desc    Purchase a dataset
const createPurchase = async (req, res) => {
  try {
    const datasetId = req.params.datasetId;
    const buyerId = req.user.id;

    // 1. Find the dataset to get its price and seller
    const datasetToPurchase = await Dataset.findById(datasetId);
    if (!datasetToPurchase) {
      return res.status(404).json({ message: 'Dataset not found' });
    }

    // 2. Check if the user has already purchased this dataset
    const existingPurchase = await Purchase.findOne({ buyer: buyerId, dataset: datasetId });
    if (existingPurchase) {
      return res.status(400).json({ message: 'You have already purchased this dataset' });
    }

    // 3. Create the new purchase record
    const newPurchase = new Purchase({
      buyer: buyerId,
      dataset: datasetId,
      seller: datasetToPurchase.seller,
      purchasePrice: datasetToPurchase.price,
    });

    await newPurchase.save();

    res.status(201).json({ message: 'Purchase successful!', purchase: newPurchase });

  } catch (error) {
    console.error('Purchase error:', error);
    res.status(500).json({ message: 'Server error during purchase process.' });
  }
};

// @desc    Get all datasets purchased by a user
const getMyPurchases = async (req, res) => {
  try {
    const purchases = await Purchase.find({ buyer: req.user.id })
      .populate({
        path: 'dataset',
        select: 'title description category price originalFileName',
        populate: {
          path: 'seller',
          select: 'name'
        }
      });
      
    res.json(purchases);
  } catch (error) {
    console.error('Get purchases error:', error);
    res.status(500).json({ message: 'Server error fetching purchased datasets.' });
  }
};

module.exports = { createPurchase, getMyPurchases };
