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
  downloadInvoicePDF
} = require('../controllers/invoiceController');

const {authMiddleware} = require('../middlewares/authMiddleware');

router.post('/',authMiddleware, createInvoice);
router.get('/',authMiddleware, getInvoices);
router.get('/paid-invoices',authMiddleware, getPaidInvoices);
router.get('/last-invoice', authMiddleware, getLastInvoice);
router.get('/total-amount', authMiddleware, getInvoicesTotalAmount);
router.get('/total-invoices', authMiddleware, getTotalInvoices);
router.get('/total/months', authMiddleware, getTotalAmountByMonth);
router.get('/:id',authMiddleware, getInvoiceById);
router.get('/:id/pdf',authMiddleware, downloadInvoicePDF);
router.patch('/:id',authMiddleware, updateInvoiceStatus);


module.exports = router;
