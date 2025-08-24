const express = require('express');
const router = express.Router();

const {
    createVD,
    getVDs,
    getVDById,
    getVDLastNumber,
    getVDsTotalAmount,
    getVDAmountByMonth,
    generateVDPDF
} = require('../controllers/vdController');
const { authMiddleware } = require('../middlewares/authMiddleware');

router.post('/', authMiddleware, createVD);
router.get('/', authMiddleware, getVDs);
router.get('/last-number', authMiddleware, getVDLastNumber);
router.get('/total-amount', authMiddleware, getVDsTotalAmount);
router.get('/amount/months', authMiddleware, getVDAmountByMonth);
router.get('/:id', authMiddleware, getVDById);
router.get('/:id/pdf', authMiddleware, generateVDPDF);

module.exports = router;