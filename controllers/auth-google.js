const dotenv = require('dotenv');
dotenv.config();
const passport = require('passport');
const jwt = require('jsonwebtoken');
const GoogleStrategy = require('passport-google-oauth2').Strategy;
const User = require('../models/user');

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

passport.use(new GoogleStrategy({
    clientID: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/callback",
    passReqToCallback: true
  },
  async function(request, accessToken, refreshToken, profile, done) {
    try {
      let user = await User.findOne({ email: profile.email });

      if (user) {
        // Update provider if necessary, to be used if other social login is also available
        if (user.provider !== 'google' || user.accountId !== profile.id) {
          user.provider = 'google';
          user.googleId = profile.id;
          await user.save();
        }
      } else {
        user = await User.create({
          googleId: profile.id,
          provider: 'google',
          username: profile.displayName,
          email: profile.email
        });
      }

      return done(null, user);
    } catch (err) {
      return done(err, null);
    }
  }
));
