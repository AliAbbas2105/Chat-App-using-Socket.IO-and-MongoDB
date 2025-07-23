const mongoose = require('mongoose');

const userVerificationLinkSchema = new mongoose.Schema({//temporay schema, which saves the data until email is verified, after that it gets deleted from here, and moved to main User model 
  name: String,
  email: String,
  hashedPassword: String,
  token: String,
  expiresAt: Date, //link expiration time
  provider: String,
}, { timestamps: true });

module.exports = mongoose.model('UserVerificationLink', userVerificationLinkSchema);
