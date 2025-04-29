const express = require('express');
const router = express.Router();
const { register, login, logout } = require('../controllers/authController');
const {registerValidation, loginValidation} = require('../middlewares/validationMiddleware');

router.post('/register',registerValidation, register);
router.post('/login',loginValidation, login);
router.post('/logout', logout);

module.exports = router;
