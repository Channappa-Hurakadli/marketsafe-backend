const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  role: { // ADDED THIS FIELD
    type: String,
    enum: ['buyer', 'seller'],
    default: 'buyer'
  },
  subscription: {
    tier: {
      type: String,
      enum: ['none', 'basic', 'pro', 'enterprise'],
      default: 'none'
    },
    uploadCount: {
      type: Number,
      default: 0
    },
    // You could add subscription start/end dates here in a real app
  },
}, {
  timestamps: true,
});

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Method to compare entered password with hashed password
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);

module.exports = User;