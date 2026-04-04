const express = require('express');
const multer = require('multer');
const router = express.Router();
const { authMiddleware } = require('../middlewares/authMiddleware');
const payment = require('../controllers/paymentController');
const features = require('../controllers/featuresController');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// Payments (partial)
router.post('/payments', authMiddleware, payment.addPayment);
router.get('/payments/:invoiceId', authMiddleware, payment.getPayments);
router.get('/payments/:id/pdf', authMiddleware, payment.downloadPaymentPDF);

// Profit per product
router.get('/product-profits', authMiddleware, features.getProductProfits);

// Sales goals
router.get('/sales-goal', authMiddleware, features.getSalesGoal);
router.post('/sales-goal', authMiddleware, features.setSalesGoal);

// IVA report
router.get('/iva-report', authMiddleware, features.getIVAReport);

// Client analysis
router.get('/client-analysis', authMiddleware, features.getClientAnalysis);

// Price history
router.get('/price-history/:productId', authMiddleware, features.getPriceHistory);

// Invoice templates
router.get('/invoice-templates', authMiddleware, features.getInvoiceTemplates);
router.post('/invoice-templates', authMiddleware, features.saveInvoiceTemplate);
router.delete('/invoice-templates/:id', authMiddleware, features.deleteInvoiceTemplate);

// Product import
router.post('/import-products', authMiddleware, upload.single('file'), features.importProducts);

module.exports = router;
