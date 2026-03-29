const mongoose = require('mongoose');
const Expense = require('../models/expense');
const { log: logActivity } = require('./activityLogController');

const CATEGORY_LABELS = {
    renda: 'Renda', salarios: 'Salários', fornecedores: 'Fornecedores',
    transporte: 'Transporte', comunicacao: 'Comunicação', material: 'Material de escritório',
    impostos: 'Impostos', manutencao: 'Manutenção', marketing: 'Marketing', outros: 'Outros'
};

exports.createExpense = async (req, res) => {
    try {
        const { category, description, amount, date, paymentMethod, reference, supplierId } = req.body;
        if (!description || !amount) {
            return res.status(400).json({ success: false, message: 'Descrição e valor são obrigatórios.' });
        }
        const expense = await Expense.create({
            companyId: req.user.company._id,
            userId: req.user._id,
            category, description, amount, date, paymentMethod, reference, supplierId
        });
        logActivity({
            companyId: req.user.company._id, userId: req.user._id, userName: req.user.name,
            action: 'created', entity: 'expense', entityId: expense._id,
            description: `Registou despesa "${description}" no valor de ${amount} MZN.`
        });
        res.json({ success: true, expense });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.getExpenses = async (req, res) => {
    try {
        const { from, to, category } = req.query;
        const filter = { companyId: req.user.company._id };
        if (category) filter.category = category;
        if (from || to) {
            filter.date = {};
            if (from) filter.date.$gte = new Date(from);
            if (to) filter.date.$lte = new Date(to);
        }
        const expenses = await Expense.find(filter).sort({ date: -1 }).populate('supplierId', 'name');
        res.json({ success: true, expenses });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.getExpenseSummary = async (req, res) => {
    try {
        const companyId = new mongoose.Types.ObjectId(req.user.company._id);
        const companyIdRaw = req.user.company._id;
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const [totalThisMonth, byCategory, last5] = await Promise.all([
            Expense.aggregate([
                { $match: { companyId, date: { $gte: startOfMonth } } },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ]),
            Expense.aggregate([
                { $match: { companyId, date: { $gte: startOfMonth } } },
                { $group: { _id: '$category', total: { $sum: '$amount' } } },
                { $sort: { total: -1 } }
            ]),
            Expense.find({ companyId: companyIdRaw }).sort({ createdAt: -1 }).limit(5)
        ]);

        res.json({
            success: true,
            summary: {
                totalThisMonth: totalThisMonth[0]?.total || 0,
                byCategory: byCategory.map(c => ({ category: c._id, label: CATEGORY_LABELS[c._id] || c._id, total: c.total })),
                recent: last5
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.deleteExpense = async (req, res) => {
    try {
        await Expense.findOneAndDelete({ _id: req.params.id, companyId: req.user.company._id });
        res.json({ success: true, message: 'Despesa eliminada.' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};