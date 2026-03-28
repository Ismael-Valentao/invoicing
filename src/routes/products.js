const express = require('express');
const router = express.Router();

const { createProduct, getProducts, getProductById, updateProduct, deleteProduct, adjustStock, setActive, deactivateProduct } = require('../controllers/productController');
const { authMiddleware } = require('../middlewares/authMiddleware');
const { checkSubscriptionActive, checkProductLimit } = require('../middlewares/checkPlanLimit');

router.post('/', authMiddleware, checkSubscriptionActive, checkProductLimit, createProduct);
router.get('/', authMiddleware, getProducts);
router.get('/:id', authMiddleware, getProductById);
router.patch('/:id', authMiddleware, updateProduct);
router.delete('/:id', authMiddleware, deleteProduct);
router.patch("/:id/stock", authMiddleware, adjustStock);
router.patch("/:id/active", authMiddleware, setActive);
router.patch("/:id/deactivate", authMiddleware, deactivateProduct);

module.exports = router;