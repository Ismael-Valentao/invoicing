const express = require('express');
const router = express.Router();
const {
  createInvoice,
  getInvoices,
  getInvoiceById
} = require('../controllers/invoiceController');

const { downloadInvoicePDF } = require('../controllers/invoiceController');
const {authMiddleware} = require('../middlewares/authMiddleware');

router.post('/',authMiddleware, createInvoice);
router.get('/',authMiddleware, getInvoices);
router.get('/:id',authMiddleware, getInvoiceById);
router.get('/:id/pdf',authMiddleware, downloadInvoicePDF);
module.exports = router;
