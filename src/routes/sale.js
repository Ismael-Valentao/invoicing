const express = require('express');
const router = express.Router();
const saleController = require('../controllers/saleController');
const {authMiddleware} = require('../middlewares/authMiddleware');

router.post('/', authMiddleware, saleController.createSale);
router.get('/', authMiddleware, saleController.getSales);
router.get("/export", authMiddleware, saleController.exportSalesExcel);
router.get("/datatable", authMiddleware, saleController.getSalesDataTable);
router.get("/dashboard-info", authMiddleware, saleController.getSalesDashboard);
router.get('/:id', authMiddleware, saleController.getSaleById);
router.patch('/:id/cancel', authMiddleware, saleController.cancelSale);
router.get("/:id/receipt", authMiddleware, saleController.getSaleReceiptPDF)

module.exports = router;