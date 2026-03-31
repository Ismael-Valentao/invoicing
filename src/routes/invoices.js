const express = require('express');
const router = express.Router();
const {
  createInvoice,
  getInvoices,
  getInvoiceById,
  getLastInvoice,
  getInvoicesTotalAmount,
  getTotalInvoices,
  getPaidInvoices,
  getTotalAmountByMonth,
  updateInvoiceStatus,
  downloadInvoicePDF,
  downloadInvoicesStatementExcel,
  getInvoicesPreview,
  getInvoicesSummary
} = require('../controllers/invoiceController');

const {authMiddleware} = require('../middlewares/authMiddleware');
const { checkSubscriptionActive, checkInvoiceLimit, checkExcelExportAllowed } = require('../middlewares/checkPlanLimit');

router.post('/', authMiddleware, checkSubscriptionActive, checkInvoiceLimit, createInvoice);
router.get('/',authMiddleware, getInvoices);
router.get('/paid-invoices',authMiddleware, getPaidInvoices);
router.get('/last-invoice', authMiddleware, getLastInvoice);
router.get('/preview', authMiddleware, getInvoicesPreview);
router.get('/summary', authMiddleware, getInvoicesSummary);
router.get('/total-amount', authMiddleware, getInvoicesTotalAmount);
router.get('/total-invoices', authMiddleware, getTotalInvoices);
router.get('/total/months', authMiddleware, getTotalAmountByMonth);

// Preview do próximo número de factura (sem incrementar o counter)
router.get('/next-number', authMiddleware, async (req, res) => {
    try {
        const Counter = require('../models/counter');
        const { buildNumber } = require('../utils/numerationGenerator');
        const year = new Date().getFullYear();
        const counter = await Counter.findOne({ companyId: req.user.company._id, type: `invoice_${year}` });
        const nextVal = (counter?.value || 0) + 1;
        res.json({ success: true, number: buildNumber('FT', year, nextVal) });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Notas de crédito e débito (ANTES das rotas /:id)
const { createCreditNote, createDebitNote, getNotes } = require('../controllers/creditDebitNoteController');
router.get('/notes', authMiddleware, getNotes);
router.post('/credit-note', authMiddleware, checkSubscriptionActive, createCreditNote);
router.post('/debit-note', authMiddleware, checkSubscriptionActive, createDebitNote);

router.get('/:id',authMiddleware, getInvoiceById);
router.get('/:id/pdf',authMiddleware, downloadInvoicePDF);
router.get("/export/excel/:filter", authMiddleware, checkExcelExportAllowed,
  downloadInvoicesStatementExcel
);
router.patch('/:id',authMiddleware, updateInvoiceStatus);

// Duplicar factura
router.post('/:id/duplicate', authMiddleware, checkSubscriptionActive, async (req, res) => {
    try {
        const Invoice = require('../models/invoice');
        const { getNextInvoiceNumber } = require('../utils/numerationGenerator');
        const original = await Invoice.findOne({ _id: req.params.id, companyId: req.user.company._id });
        if (!original) return res.status(404).json({ success: false, message: 'Factura não encontrada.' });
        const invoiceNumber = await getNextInvoiceNumber(req.user.company._id);
        const newDoc = await Invoice.create({
            docType: original.docType,
            companyId: original.companyId,
            userId: req.user._id,
            clientId: original.clientId,
            companyName: original.companyName,
            clientName: original.clientName,
            clientNUIT: original.clientNUIT,
            invoiceNumber,
            items: original.items,
            appliedTax: original.appliedTax,
            subTotal: original.subTotal,
            tax: original.tax,
            totalAmount: original.totalAmount,
            showBankDetails: original.showBankDetails,
            showNotes: original.showNotes,
            status: 'unpaid',
            date: new Date(),
        });
        const { log: logActivity } = require('../controllers/activityLogController');
        logActivity({
            companyId: req.user.company._id, userId: req.user._id, userName: req.user.name,
            action: 'duplicated', entity: 'invoice', entityId: newDoc._id,
            description: `Duplicou factura ${original.invoiceNumber} → ${newDoc.invoiceNumber}.`
        });
        res.json({ success: true, message: 'Factura duplicada.', invoice: newDoc });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
