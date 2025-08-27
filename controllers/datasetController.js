const Dataset = require('../models/Dataset');
const Purchase = require('../models/Purchase');
const User = require('../models/User');
const path = require('path');
const fs = require('fs');
const csv = require('csv-parser');
const { spawn } = require('child_process'); // Import spawn to run Python script

const TIER_LIMITS = {
  basic: 5,
  pro: 20,
  enterprise: Infinity
};

const uploadDataset = async (req, res) => {
  try {
    const seller = await User.findById(req.user.id);

    // Subscription and validation checks
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

    // Save initial dataset record with 'processing' status
    const newDataset = new Dataset({
      seller: req.user.id,
      title, description, price, category,
      isListed: isListed === 'true',
      status: 'processing',
      originalFileName: req.file.originalname,
      filePath: req.file.path,
      fileType: req.file.mimetype,
      fileSize: req.file.size,
    });
    await newDataset.save();

    seller.subscription.uploadCount += 1;
    await seller.save();

    // --- Anonymization Integration ---
    const inputPath = path.resolve(newDataset.filePath);
    const outputPath = path.resolve(req.file.destination, `anonymized-${newDataset._id}.csv`);

    // Requirement 1: Execute the Python script with the uploaded file as input
    const pythonProcess = spawn('python', ['anonymize.py', inputPath, outputPath]);

    pythonProcess.stdout.on('data', (data) => console.log(`Python Script: ${data}`));
    pythonProcess.stderr.on('data', (data) => console.error(`Python Script Error: ${data}`));

    pythonProcess.on('close', async (code) => {
      if (code === 0) {
        let dataPoints = 0;
        fs.createReadStream(outputPath).pipe(csv()).on('data', () => dataPoints++)
          .on('end', async () => {
            newDataset.status = 'anonymized';
            newDataset.anonymizedFilePath = outputPath;
            newDataset.dataPoints = dataPoints;
            await newDataset.save();
            console.log(`Dataset ${newDataset._id} successfully anonymized.`);
          });
      } else {
        newDataset.status = 'failed';
        await newDataset.save();
        console.error(`Anonymization failed for dataset ${newDataset._id}.`);
      }
    });
    
    res.status(201).json(newDataset);

  } catch (error) {
    res.status(500).json({ message: 'Server error during upload initiation.' });
  }
};

const getMyDatasets = async (req, res) => {
  try {
    const datasets = await Dataset.find({ seller: req.user.id }).sort({ createdAt: -1 });
    res.json(datasets);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Requirement 2: The anonymized dataset is what gets listed
const getMarketplaceDatasets = async (req, res) => {
  try {
    const userPurchases = await Purchase.find({ buyer: req.user.id }).select('dataset');
    const purchasedDatasetIds = userPurchases.map(p => p.dataset);
    const datasets = await Dataset.find({
      isListed: true,
      status: 'anonymized', // Only show fully processed datasets
      _id: { $nin: purchasedDatasetIds }
    }).populate('seller', 'name');
    res.json(datasets);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Requirement 3: Preview the ANONYMIZED data
const previewDataset = async (req, res) => {
    try {
        await Dataset.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } });
        const dataset = await Dataset.findById(req.params.id);
        if (!dataset || dataset.status !== 'anonymized' || !dataset.anonymizedFilePath) {
            return res.status(404).json({ message: 'Anonymized dataset not found or still processing.' });
        }
        const results = [];
        fs.createReadStream(path.resolve(dataset.anonymizedFilePath))
            .pipe(csv())
            .on('data', (data) => { if (results.length < 5) results.push(data); })
            .on('end', () => res.json({ headers: results.length > 0 ? Object.keys(results[0]) : [], rows: results }))
            .on('error', () => res.status(500).json({ message: 'Error reading file for preview.' }));
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

const updateDatasetListing = async (req, res) => {
  try {
    const dataset = await Dataset.findById(req.params.id);
    if (!dataset) return res.status(404).json({ message: 'Dataset not found' });
    if (dataset.seller.toString() !== req.user.id) return res.status(401).json({ message: 'User not authorized' });
    if (dataset.status !== 'anonymized') {
      return res.status(400).json({ message: 'Dataset is still processing and cannot be listed.' });
    }
    dataset.isListed = req.body.isListed;
    const updatedDataset = await dataset.save();
    res.json(updatedDataset);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Requirement 3: Download the ANONYMIZED data for buyers
const downloadDataset = async (req, res) => {
  try {
    const purchaseRecord = await Purchase.findOne({ buyer: req.user.id, dataset: req.params.id });
    if (!purchaseRecord) return res.status(403).json({ message: 'You have not purchased this dataset.' });
    
    const dataset = await Dataset.findById(req.params.id);
    if (!dataset || !dataset.anonymizedFilePath) {
      return res.status(404).json({ message: 'Anonymized dataset file not found.' });
    }
    res.download(path.resolve(dataset.anonymizedFilePath), `purchased_${dataset.originalFileName}`);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Requirement 3: Download the seller's own ANONYMIZED dataset
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
