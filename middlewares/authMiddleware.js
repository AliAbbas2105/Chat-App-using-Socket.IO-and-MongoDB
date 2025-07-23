const jwt = require('jsonwebtoken');
const User = require('../models/user'); // adjust the path
require('dotenv').config();

async function authenticateToken(req, res, next) {
  console.log('🔒 authenticateToken hit:', req.method, req.originalUrl);
  const authorizationHeader = req.headers['authorization'];
  // const token = req.cookies.token || (authorizationHeader && authorizationHeader.split(' ')[1]);
  let token = null;

  if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  } else if (authorizationHeader && authorizationHeader.startsWith('Bearer ')) {
    token = authorizationHeader.split(' ')[1];
  }
  if (!token) return res.status(401).json({message:'Authorization token required'}); //No token or invalid token provided in headers
console.log('Cookies:', req.cookies);
console.log('Authorization header:', req.headers['authorization']);

  try {
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) return res.sendStatus(403);//No permission to access the resource

    // Comparing token version
    if (decoded.tokenVersion !== user.tokenVersion) {
      return res.status(401).json({ message: 'Token expired or invalid' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(403).json({ message: 'Invalid token' }); //you have token, but it's now invalid and you no longer have access
  }
}

module.exports = authenticateToken;