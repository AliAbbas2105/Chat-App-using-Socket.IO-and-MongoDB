const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email:    { type: String, required: true, unique: true },
  password: { type: String },
  tokenVersion: {type:Number,default:0},
  isVerified: { type: Boolean, default: false },
  provider: { type: String, required: true, },
  googleId: { type: String }, // for social login
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
