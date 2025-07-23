const express = require('express');
const router = express.Router();
const controller=require('../controllers/userController')
const {verifyLink} = require('../controllers/linkVerifyController')
const authenticateToken = require('../middlewares/authMiddleware');


router.post('/signup',controller.Signup);
router.get('/verify-link/:token', verifyLink);
router.post('/login', controller.Login);
router.get('/login', (req, res) => {
  res.render('login');
})
//router.use(authenticateToken);
router.post('/logout',authenticateToken, controller.Logout);
router.get('/showAllUsers',authenticateToken,controller.ShowAllUsers);

module.exports = router;