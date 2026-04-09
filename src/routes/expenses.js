const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middlewares/authMiddleware');
const { checkSubscriptionActive } = require('../middlewares/checkPlanLimit');
const { createExpense, getExpenses, getExpenseSummary, deleteExpense } = require('../controllers/expenseController');

router.post('/', authMiddleware, checkSubscriptionActive, createExpense);
router.get('/', authMiddleware, getExpenses);
router.get('/summary', authMiddleware, getExpenseSummary);
router.delete('/:id', authMiddleware, checkSubscriptionActive, deleteExpense);

module.exports = router;