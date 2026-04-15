const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middlewares/authMiddleware');
const { getMyReferrals, validateCode } = require('../controllers/referralController');

router.get('/me', authMiddleware, getMyReferrals);
router.get('/validate/:code', validateCode);

module.exports = router;
