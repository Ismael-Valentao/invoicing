const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    amount: { type: Number, required: true },
    paymentMethod: { type: String, enum: ['cash', 'mpesa', 'emola', 'card', 'bank'], default: 'cash' },
    reference: { type: String },
    notes: { type: String },
    receiptNumber: { type: String },
    date: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('Payment', paymentSchema);