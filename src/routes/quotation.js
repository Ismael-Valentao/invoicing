const express = require('express');
const router = express.Router();
const {
    createQuotation,
    getQuotations,
    getQuotationById,
    getLastQuotation,
    getQuotationsTotalAmount,
    getTotalQuotations,
    downloadQuotationPDF,
    approveQuotation
} = require('../controllers/quotationController');

const { authMiddleware } = require('../middlewares/authMiddleware');
const { checkSubscriptionActive } = require('../middlewares/checkPlanLimit');

router.post('/', authMiddleware, checkSubscriptionActive, createQuotation);
router.get('/', authMiddleware, getQuotations);
router.get('/last-Quotation', authMiddleware, getLastQuotation);
router.get('/total-amount', authMiddleware, getQuotationsTotalAmount);
router.get('/total-Quotations', authMiddleware, getTotalQuotations);
router.get('/:id', authMiddleware, getQuotationById);
router.get('/:id/pdf', authMiddleware, downloadQuotationPDF);
// Preview do próximo número de cotação (sem incrementar)
router.get('/next-number', authMiddleware, async (req, res) => {
    try {
        const Counter = require('../models/counter');
        const { buildNumber } = require('../utils/numerationGenerator');
        const year = new Date().getFullYear();
        const counter = await Counter.findOne({ companyId: req.user.company._id, type: `quotation_${year}` });
        const nextVal = (counter?.value || 0) + 1;
        res.json({ success: true, number: buildNumber('CT', year, nextVal) });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.patch('/:id/approve', authMiddleware, checkSubscriptionActive, approveQuotation);

// Duplicar cotação
router.post('/:id/duplicate', authMiddleware, checkSubscriptionActive, async (req, res) => {
    try {
        const Quotation = require('../models/invoice');
        const { getNextQuotationNumber } = require('../utils/numerationGenerator');
        const original = await Quotation.findOne({ _id: req.params.id, companyId: req.user.company._id });
        if (!original) return res.status(404).json({ success: false, message: 'Cotação não encontrada.' });
        const quotationNumber = await getNextQuotationNumber(req.user.company._id);
        const newDoc = await Quotation.create({
            docType: 'quotation',
            companyId: original.companyId,
            userId: req.user._id,
            clientId: original.clientId,
            companyName: original.companyName,
            clientName: original.clientName,
            clientNUIT: original.clientNUIT,
            invoiceNumber: quotationNumber,
            items: original.items,
            appliedTax: original.appliedTax,
            subTotal: original.subTotal,
            tax: original.tax,
            totalAmount: original.totalAmount,
            showBankDetails: original.showBankDetails,
            showNotes: original.showNotes,
            status: 'pending',
            date: new Date(),
        });
        const { log: logActivity } = require('../controllers/activityLogController');
        logActivity({
            companyId: req.user.company._id, userId: req.user._id, userName: req.user.name,
            action: 'duplicated', entity: 'quotation', entityId: newDoc._id,
            description: `Duplicou cotação ${original.invoiceNumber} → ${newDoc.invoiceNumber}.`
        });
        res.json({ success: true, message: 'Cotação duplicada.', quotation: newDoc });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
