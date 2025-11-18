const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

router.post('/request-otp', userController.requestOTP);
router.post('/verify-otp', userController.verifyOTP);
router.post('/create-user', userController.createUser);
router.post('/signin', userController.signIn);
router.post('/reset-password', userController.resetPassword);
router.post('/logout', userController.logout);
router.get('/verify-auth', userController.verifyAuth);
router.get('/profile', userController.authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
