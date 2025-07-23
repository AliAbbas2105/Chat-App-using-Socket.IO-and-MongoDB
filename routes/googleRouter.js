const express = require('express');
const passport = require('passport');
const router = express.Router();
const jwt = require('jsonwebtoken');
require('dotenv').config();
const User = require('../models/user')

router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/google/callback', passport.authenticate('google', { session: false, failureRedirect: '/auth/failure' }),
  async (req, res) => {//on successful the following occur
    if (!req.user) return res.redirect('/');

  try {
    const user = await User.findOne({ email: req.user.email });

    user.tokenVersion += 1;
    await user.save();

    
    const token = jwt.sign(
      { id: user._id, tokenVersion: user.tokenVersion },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: '1h' }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 3600000 // 1 hour
    });

    res.render('homepage');
    // returning token to be used for using protected routes
    // res.json({
    //   message: 'Google login successful',
    //   token,
    //   user: {
    //     name: user.name,
    //     email: user.email,
    //     provider: user.provider
    //   }
    // });

  } catch (err) {
    console.error('JWT creation failed:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/failure', (req, res) => {
  res.send('<h2>Login failed</h2><a href="/auth">Try Again</a>');
});

router.get('/signout', (req, res, next) => {
  if (!req.user) return res.redirect('/');

  req.logout(function(err) {
    if (err) return next(err);
    req.session.destroy(() => {
      res.clearCookie('connect.sid');
      res.redirect('/');
    });
  });
});

module.exports = router;

// router.get('/google/callback',
//   passport.authenticate('google', {
//     failureRedirect: '/auth/failure',
//     successRedirect: '/auth/success',
//   })
// );