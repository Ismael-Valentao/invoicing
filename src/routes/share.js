const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middlewares/authMiddleware');
const { getShareInfo } = require('../controllers/shareController');

router.get('/:type/:id', authMiddleware, getShareInfo);

module.exports = router;
