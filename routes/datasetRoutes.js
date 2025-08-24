const express = require('express');
const router = express.Router();
const {
  uploadDataset,
  getMyDatasets,
  getMarketplaceDatasets,
  previewDataset,
  updateDatasetListing,
  downloadDataset,
  downloadAnonymizedDataset,
} = require('../controllers/datasetController');
const { protect, authorize } = require('../middleware/authMiddleware');
const upload = require('../middleware/fileUpload');

// Seller routes
router.post('/upload', protect, authorize('seller'), upload, uploadDataset);
router.get('/my-datasets', protect, authorize('seller'), getMyDatasets);
router.patch('/:id/list', protect, authorize('seller'), updateDatasetListing);
router.get('/:id/download-anonymized', protect, authorize('seller'), downloadAnonymizedDataset);

// Buyer routes
router.get('/marketplace', protect, authorize('buyer'), getMarketplaceDatasets);
router.get('/:id/preview', protect, authorize('buyer'), previewDataset);
router.get('/:id/download', protect, authorize('buyer'), downloadDataset);

module.exports = router;
