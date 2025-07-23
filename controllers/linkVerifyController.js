const transporter = require('../utils/mailer');
const { welcomeEmailTemplate } = require('../utils/emailTemplates');
const UserVerificationLink = require('../models/userLinkverification');
const User = require('../models/user');

async function verifyLink(req, res) {
  try {
    const { token } = req.params;

    const record = await UserVerificationLink.findOne({ token });
    if (!record) return res.status(404).send('Invalid or expired link');

    if (record.expiresAt < Date.now()) {
      await UserVerificationLink.deleteOne({ _id: record._id });
      return res.status(400).send('Link expired. Please signup again.');
    }

    // Check again to avoid duplicate users
    const existing = await User.findOne({ email: record.email });
    if (existing) {
      await UserVerificationLink.deleteOne({ _id: record._id });
      return res.status(409).send('User already exists.');
    }

    const newUser = new User({
      username: record.name,
      email: record.email,
      password: record.hashedPassword,
      isVerified: true,
      provider: 'custom',
    });

    await newUser.save();
    await UserVerificationLink.deleteOne({ _id: record._id });

    // Sending welcome email
    try {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: newUser.email,
        subject: 'Welcome to Code Xperts!',
        html: welcomeEmailTemplate(newUser.username),
      });
    } catch (emailErr) {
      console.warn('User created, but welcome email failed:', emailErr.message);
    }
    
    res.status(200).json({
      message: 'Email verified and user created successfully. Welcome email sent.',
      userId: newUser._id,
    });

  } catch (err) {
    console.error(err);
    res.status(500).send('Verification failed.');
  }
}
 module.exports={
    verifyLink
 }