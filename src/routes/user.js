const express = require('express');
const router = express.Router();

const {verifyEmail, resendVerification} = require("../controllers/userController")

router.get('/verify-email/:token', verifyEmail);
router.post('/resend-verification', resendVerification);


module.exports = router