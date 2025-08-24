const express = require('express');
const router = express.Router();
const {authMiddleware} = require('../middlewares/authMiddleware');

const {
    getRecibos,
    downloadReciboPDF
} = require('../controllers/reciboController');

router.get('/',authMiddleware, getRecibos)
router.get('/:id/pdf', authMiddleware, downloadReciboPDF);

module.exports = router;