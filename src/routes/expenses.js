const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middlewares/authMiddleware');
const { createExpense, getExpenses, getExpenseSummary, deleteExpense } = require('../controllers/expenseController');

router.post('/', authMiddleware, createExpense);
router.get('/', authMiddleware, getExpenses);
router.get('/summary', authMiddleware, getExpenseSummary);
router.delete('/:id', authMiddleware, deleteExpense);

module.exports = router;