const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    category: {
        type: String,
        enum: ['renda', 'salarios', 'fornecedores', 'transporte', 'comunicacao', 'material', 'impostos', 'manutencao', 'marketing', 'outros'],
        default: 'outros'
    },
    description: { type: String, required: true },
    amount: { type: Number, required: true },
    date: { type: Date, default: Date.now },
    paymentMethod: { type: String, enum: ['cash', 'mpesa', 'emola', 'card', 'bank'], default: 'cash' },
    reference: { type: String },
    supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' },
    recurring: { type: Boolean, default: false },
    recurrenceInterval: { type: String, enum: ['weekly', 'monthly', 'yearly', null], default: null },
}, { timestamps: true });

module.exports = mongoose.model('Expense', expenseSchema);