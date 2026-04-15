const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const { createProduct, getProducts, getProductById, updateProduct, deleteProduct, adjustStock, setActive, deactivateProduct, downloadImportTemplate, importProducts } = require('../controllers/productController');
const { authMiddleware } = require('../middlewares/authMiddleware');
const { checkSubscriptionActive, checkProductLimit } = require('../middlewares/checkPlanLimit');

router.get('/import/template', authMiddleware, downloadImportTemplate);
router.post('/import', authMiddleware, checkSubscriptionActive, upload.single('file'), importProducts);
router.post('/', authMiddleware, checkSubscriptionActive, checkProductLimit, createProduct);
router.get('/', authMiddleware, getProducts);
router.get('/:id', authMiddleware, getProductById);
router.patch('/:id', authMiddleware, checkSubscriptionActive, updateProduct);
router.delete('/:id', authMiddleware, checkSubscriptionActive, deleteProduct);
router.patch("/:id/stock", authMiddleware, checkSubscriptionActive, adjustStock);
router.patch("/:id/active", authMiddleware, checkSubscriptionActive, setActive);
router.patch("/:id/deactivate", authMiddleware, checkSubscriptionActive, deactivateProduct);

module.exports = router;