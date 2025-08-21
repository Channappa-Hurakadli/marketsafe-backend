const mongoose = require('mongoose');

const purchaseSchema = new mongoose.Schema({
  buyer: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User',
  },
  dataset: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'Dataset',
  },
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User',
  },
  purchasePrice: {
    type: Number,
    required: true,
  },
}, {
  timestamps: true,
});

// Ensure a buyer can only purchase a dataset once
purchaseSchema.index({ buyer: 1, dataset: 1 }, { unique: true });

const Purchase = mongoose.model('Purchase', purchaseSchema);

module.exports = Purchase;
