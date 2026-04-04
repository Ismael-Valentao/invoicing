const express = require('express');
const router = express.Router();
const { register, login, logout, refreshToken } = require('../controllers/authController');
const { authMiddleware } = require('../middlewares/authMiddleware');
const {registerValidation, loginValidation} = require('../middlewares/validationMiddleware');
const loginRateLimit = require('../middlewares/loginRateLimit');
router.post('/register',registerValidation, register);
router.post('/login',loginRateLimit, loginValidation, login);
router.post('/logout', logout);
router.post('/refresh-token', authMiddleware, refreshToken);

module.exports = router;
