const Dataset = require('../models/Dataset');
const Purchase = require('../models/Purchase');
const User = require('../models/User');
const path = require('path');
const fs = require('fs');
const csv = require('csv-parser');

const TIER_LIMITS = {
  basic: 5,
  pro: 20,
  enterprise: Infinity
};

/**
 * @desc    Upload a new dataset, check subscription, and start anonymization
 * @route   POST /api/datasets/upload
 * @access  Private (Sellers only)
 */
const uploadDataset = async (req, res) => {
  try {
    const seller = await User.findById(req.user.id);

    // Requirement 5: Check subscription and upload limits
    if (seller.subscription.tier === 'none') {
      return res.status(403).json({ message: 'You must have an active subscription to upload datasets.' });
    }
    const limit = TIER_LIMITS[seller.subscription.tier];
    if (seller.subscription.uploadCount >= limit) {
      return res.status(403).json({ message: `You have reached your upload limit of ${limit} for the ${seller.subscription.tier} plan.` });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'Please upload a file.' });
    }
    const { title, description, price, isListed, category } = req.body;
    if (!title || !description || price === undefined) {
      return res.status(400).json({ message: 'Please provide title, description, and price.' });
    }

    // Count rows to determine dataPoints
    let dataPoints = 0;
    fs.createReadStream(path.resolve(req.file.path))
      .pipe(csv())
      .on('data', () => dataPoints++)
      .on('end', async () => {
        try {
          const newDataset = new Dataset({
            seller: req.user.id,
            title,
            description,
            price,
            category,
            isListed: isListed === 'true', // Convert string from FormData to boolean
            dataPoints,
            views: 0,
            status: 'processing', // Requirement 1: Start as processing
            anonymizedFilePath: null,
            originalFileName: req.file.originalname,
            filePath: req.file.path,
            fileType: req.file.mimetype,
            fileSize: req.file.size,
          });
          await newDataset.save();

          // Increment seller's upload count
          seller.subscription.uploadCount += 1;
          await seller.save();

          // Simulate the anonymization process
          setTimeout(() => {
            newDataset.status = 'anonymized';
            newDataset.anonymizedFilePath = newDataset.filePath; // In a real app, this would be a new file path
            newDataset.save();
            console.log(`Dataset ${newDataset._id} has been "anonymized".`);
          }, 10000); // 10-second delay

          res.status(201).json(newDataset);
        } catch (dbError) {
          res.status(500).json({ message: 'Failed to save dataset to database.' });
        }
      });
  } catch (error) {
    res.status(500).json({ message: 'Server error during upload.' });
  }
};

/**
 * @desc    Get all datasets uploaded by the logged-in seller
 * @route   GET /api/datasets/my-datasets
 * @access  Private (Sellers only)
 */
const getMyDatasets = async (req, res) => {
  try {
    const datasets = await Dataset.find({ seller: req.user.id }).sort({ createdAt: -1 });
    res.json(datasets);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * @desc    Get all listed datasets for the marketplace, excluding purchased ones
 * @route   GET /api/datasets/marketplace
 * @access  Private (Buyers only)
 */
const getMarketplaceDatasets = async (req, res) => {
  try {
    const userPurchases = await Purchase.find({ buyer: req.user.id }).select('dataset');
    const purchasedDatasetIds = userPurchases.map(p => p.dataset);
    const datasets = await Dataset.find({
      isListed: true,
      _id: { $nin: purchasedDatasetIds }
    }).populate('seller', 'name');
    res.json(datasets);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * @desc    Get a preview of a dataset (first 5 rows) and increment views
 * @route   GET /api/datasets/:id/preview
 * @access  Private (Buyers only)
 */
const previewDataset = async (req, res) => {
  try {
    const dataset = await Dataset.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } }, { new: true });
    if (!dataset) {
      return res.status(404).json({ message: 'Dataset not found' });
    }
    const results = [];
    fs.createReadStream(path.resolve(dataset.filePath))
      .pipe(csv())
      .on('data', (data) => { if (results.length < 5) results.push(data); })
      .on('end', () => res.json({ headers: results.length > 0 ? Object.keys(results[0]) : [], rows: results }))
      .on('error', () => res.status(500).json({ message: 'Error reading file for preview.' }));
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * @desc    Update a dataset's listing status after a simulated payment
 * @route   PATCH /api/datasets/:id/list
 * @access  Private (Sellers only)
 */
const updateDatasetListing = async (req, res) => {
  try {
    const dataset = await Dataset.findById(req.params.id);
    if (!dataset) return res.status(404).json({ message: 'Dataset not found' });
    if (dataset.seller.toString() !== req.user.id) return res.status(401).json({ message: 'User not authorized' });
    if (dataset.status !== 'anonymized') {
      return res.status(400).json({ message: 'Dataset is still processing and cannot be listed.' });
    }
    
    // Requirement 4: Simulate payment for listing
    // In a real app, you would verify payment here.
    
    dataset.isListed = req.body.isListed;
    const updatedDataset = await dataset.save();
    res.json(updatedDataset);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * @desc    Download a purchased dataset file
 * @route   GET /api/datasets/:id/download
 * @access  Private (Buyers who have purchased)
 */
const downloadDataset = async (req, res) => {
  try {
    const purchaseRecord = await Purchase.findOne({ buyer: req.user.id, dataset: req.params.id });
    if (!purchaseRecord) {
      return res.status(403).json({ message: 'Access denied. You have not purchased this dataset.' });
    }
    const dataset = await Dataset.findById(req.params.id);
    if (!dataset || !dataset.filePath) {
      return res.status(404).json({ message: 'Dataset or file path not found.' });
    }
    res.download(path.resolve(dataset.filePath), dataset.originalFileName);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * @desc    Download the seller's own anonymized dataset
 * @route   GET /api/datasets/:id/download-anonymized
 * @access  Private (Sellers only)
 */
const downloadAnonymizedDataset = async (req, res) => {
    try {
        const dataset = await Dataset.findById(req.params.id);
        if (!dataset) return res.status(404).json({ message: 'Dataset not found.' });
        if (dataset.seller.toString() !== req.user.id) return res.status(403).json({ message: 'Access denied.' });
        if (dataset.status !== 'anonymized' || !dataset.anonymizedFilePath) {
            return res.status(400).json({ message: 'Anonymized file is not yet available.' });
        }
        res.download(path.resolve(dataset.anonymizedFilePath), `anonymized_${dataset.originalFileName}`);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = {
  uploadDataset,
  getMyDatasets,
  getMarketplaceDatasets,
  previewDataset,
  updateDatasetListing,
  downloadDataset,
  downloadAnonymizedDataset,
};
