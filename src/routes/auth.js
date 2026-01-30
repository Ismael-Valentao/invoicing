const express = require('express');
const router = express.Router();
const { register, login, logout } = require('../controllers/authController');
const {registerValidation, loginValidation} = require('../middlewares/validationMiddleware');
const loginRateLimit = require('../middlewares/loginRateLimit');
router.post('/register',registerValidation, register);
router.post('/login',loginRateLimit, loginValidation, login);
router.post('/logout', logout);

module.exports = router;
