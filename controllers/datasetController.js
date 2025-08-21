const Dataset = require('../models/Dataset');
const Purchase = require('../models/Purchase');
const path = require('path');
const fs = require('fs');
const csv = require('csv-parser');

// --- Existing Functions (with updates) ---

// UPDATED: Now saves the category from the request body
const uploadDataset = async (req, res) => {
  const { title, description, price, isAnonymized, isListed, category } = req.body;
  
  if (!req.file) {
    return res.status(400).json({ message: 'Please upload a file' });
  }
  if (!title || !description || price === undefined) {
    return res.status(400).json({ message: 'Please provide title, description, and price' });
  }

  try {
    const newDataset = new Dataset({
      seller: req.user.id,
      title,
      description,
      price,
      category, // Save the category
      isAnonymized,
      isListed,
      originalFileName: req.file.originalname,
      filePath: req.file.path,
      fileType: req.file.mimetype,
      fileSize: req.file.size,
    });

    const savedDataset = await newDataset.save();
    res.status(201).json(savedDataset);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getMyDatasets = async (req, res) => {
  try {
    const datasets = await Dataset.find({ seller: req.user.id });
    res.json(datasets);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getMarketplaceDatasets = async (req, res) => {
  try {
    const datasets = await Dataset.find({ isListed: true }).populate('seller', 'name');
    res.json(datasets);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// --- NEW FUNCTIONS ---

// @desc    Get a preview of a dataset (first 5 rows)
// @route   GET /api/datasets/:id/preview
// @access  Private (Buyers only)
const previewDataset = async (req, res) => {
    try {
        const dataset = await Dataset.findById(req.params.id);
        if (!dataset) {
            return res.status(404).json({ message: 'Dataset not found' });
        }

        const results = [];
        const absolutePath = path.resolve(dataset.filePath);

        fs.createReadStream(absolutePath)
            .pipe(csv())
            .on('data', (data) => {
                if (results.length < 5) {
                    results.push(data);
                }
            })
            .on('end', () => {
                if (results.length > 0) {
                    res.json({ headers: Object.keys(results[0]), rows: results });
                } else {
                    res.json({ headers: [], rows: [] });
                }
            })
            .on('error', (error) => {
                console.error('CSV Preview Error:', error);
                res.status(500).json({ message: 'Error reading dataset file for preview.' });
            });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Update a dataset's listing status
// @route   PATCH /api/datasets/:id/list
// @access  Private (Sellers only)
const updateDatasetListing = async (req, res) => {
    try {
        const dataset = await Dataset.findById(req.params.id);

        if (!dataset) {
            return res.status(404).json({ message: 'Dataset not found' });
        }

        // Ensure the person updating is the one who uploaded it
        if (dataset.seller.toString() !== req.user.id) {
            return res.status(401).json({ message: 'User not authorized' });
        }

        dataset.isListed = req.body.isListed;
        const updatedDataset = await dataset.save();
        res.json(updatedDataset);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Download a purchased dataset file
// @route   GET /api/datasets/:id/download
// @access  Private (Buyers who have purchased)
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

    const absolutePath = path.resolve(dataset.filePath);
    res.download(absolutePath, dataset.originalFileName);
  } catch (error) {
    res.status(500).json({ message: 'Server error during file download.' });
  }
};


module.exports = {
  uploadDataset,
  getMyDatasets,
  getMarketplaceDatasets,
  previewDataset,
  updateDatasetListing,
  downloadDataset,
};
