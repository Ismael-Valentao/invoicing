const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middlewares/authMiddleware');
const { createSupplier, getSuppliers, updateSupplier, deleteSupplier } = require('../controllers/supplierController');

router.post('/', authMiddleware, createSupplier);
router.get('/', authMiddleware, getSuppliers);
router.patch('/:id', authMiddleware, updateSupplier);
router.delete('/:id', authMiddleware, deleteSupplier);

module.exports = router;