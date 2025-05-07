const express = require('express');
const router = express.Router();
const {
    createQuotation,
    getQuotations,
    getQuotationById,
    getLastQuotation,
    getQuotationsTotalAmount,
    getTotalQuotations,
    downloadQuotationPDF
} = require('../controllers/quotationController');

const { authMiddleware } = require('../middlewares/authMiddleware');

router.post('/', authMiddleware, createQuotation);
router.get('/', authMiddleware, getQuotations);
router.get('/last-Quotation', authMiddleware, getLastQuotation);
router.get('/total-amount', authMiddleware, getQuotationsTotalAmount);
router.get('/total-Quotations', authMiddleware, getTotalQuotations);
router.get('/:id', authMiddleware, getQuotationById);
router.get('/:id/pdf', authMiddleware, downloadQuotationPDF);


module.exports = router;
