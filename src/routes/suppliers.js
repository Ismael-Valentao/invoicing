const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middlewares/authMiddleware');
const { checkSubscriptionActive } = require('../middlewares/checkPlanLimit');
const { createSupplier, getSuppliers, updateSupplier, deleteSupplier } = require('../controllers/supplierController');

router.post('/', authMiddleware, checkSubscriptionActive, createSupplier);
router.get('/', authMiddleware, getSuppliers);
router.patch('/:id', authMiddleware, checkSubscriptionActive, updateSupplier);
router.delete('/:id', authMiddleware, checkSubscriptionActive, deleteSupplier);

module.exports = router;