const jwt = require('jsonwebtoken')
const bcrypt=require('bcrypt')
require('dotenv').config();
const User=require('../models/user')

const { v4: uuidv4 } = require('uuid'); //for generating unique token for sending with link in email
const UserVerificationLink = require('../models/userLinkverification');
const { linkEmailTemplate } = require('../utils/emailTemplates');
const transporter = require('../utils/mailer');

async function Signup(req, res) {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Missing fields' });
    }

    const emailExists = await User.findOne({ email });
    if (emailExists) return res.status(400).json({ error: 'Email already in use' });

    const salt = await bcrypt.genSalt();
    const hashedPassword = await bcrypt.hash(password, salt);

    await UserVerificationLink.deleteMany({ email }); // clear old pending records

    const token = uuidv4(); // unique token
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    const pendingUser = new UserVerificationLink({
      name: username,
      email,
      hashedPassword,
      token,
      expiresAt,
      provider: 'custom' // for manual signup
    });

    await pendingUser.save();

    const verificationLink = `${process.env.BASE_URL}/verify-link/${token}`;

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Confirm Your Email',
      html: linkEmailTemplate(verificationLink),
    });

    res.status(200).json({ message: 'Verification link sent. Please confirm your email and then login.' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Signup failed' });
  }
}


async function Login(req, res) {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: 'User not found' });

    if (!user.isVerified) return res.status(401).json({ error: 'Email not verified' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid password' });

    user.tokenVersion += 1;
    await user.save();

    const token = jwt.sign(
      { id: user._id, tokenVersion: user.tokenVersion },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: '1h' }
    );

    res.cookie('token', token, {
      httpOnly: true,           // prevents JS access (protects from XSS)
      secure: process.env.NODE_ENV === 'production',
      maxAge: 3600000
    });


    res.render('homepage'); //for frontend
    // res.json({ message: 'Login successful', token });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
}

// POST /logout
async function Logout(req, res) {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.tokenVersion += 1;
    await user.save();

    res.status(200).json({ message: 'Logged out successfully, token invalidated' });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ message: 'Logout failed' });
  }
};


async function ShowAllUsers(req,res) {
    const users = await User.find().select('username')
    res.json(users);
}

module.exports={
    Signup,
    Login,
    Logout,
    ShowAllUsers,
};