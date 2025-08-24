const mongoose = require('mongoose');

const datasetSchema = new mongoose.Schema({
  seller: { // Renamed from 'user' for clarity
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User',
  },
  title: { // Added for the marketplace listing
    type: String,
    required: [true, 'Please provide a title for your dataset'],
  },
  description: { // Added for the marketplace listing
    type: String,
    required: [true, 'Please provide a description'],
  },
  price: { // Added for the marketplace listing
    type: Number,
    required: [true, 'Please set a price for your dataset'],
    default: 0,
  },
  category: {
    type: String,
    required: [true, 'Please specify a category'],
    default: 'E-commerce',
  },
   views: {
    type: Number,
    default: 0,
  },
  dataPoints: {
    type: Number,
    default: 0,
  },
  isAnonymized: { // To track the status from your diagram
    type: Boolean,
    default: false,
  },
  isListed: { // To control visibility in the marketplace
    type: Boolean,
    default: false,
  },
  originalFileName: { // Good to keep the original name
    type: String,
    required: true,
  },
  filePath: {
    type: String,
    required: true,
  },
  fileType: {
    type: String,
    required: true,
  },
  fileSize: {
    type: Number,
    required: true,
  },
  status: {
    type: String,
    enum: ['processing', 'anonymized', 'failed'],
    default: 'processing'
  },
  anonymizedFilePath: {
    type: String, // Path to the processed, downloadable file
  },
}, {
  timestamps: true,
});

const Dataset = mongoose.model('Dataset', datasetSchema);

module.exports = Dataset;
