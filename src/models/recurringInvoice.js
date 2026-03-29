const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
    description: { type: String, required: true },
    quantity: { type: Number, required: true },
    unitPrice: { type: Number, required: true },
}, { _id: false });

const recurringInvoiceSchema = new mongoose.Schema({
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client' },
    clientName: { type: String, required: true },
    clientNUIT: { type: String },
    items: [itemSchema],
    appliedTax: { type: Number, default: 0.16 },
    subTotal: { type: Number, required: true },
    tax: { type: Number, required: true },
    totalAmount: { type: Number, required: true },
    interval: { type: String, enum: ['weekly', 'monthly', 'quarterly', 'yearly'], default: 'monthly' },
    nextRunDate: { type: Date, required: true },
    lastRunDate: { type: Date },
    active: { type: Boolean, default: true },
    generatedCount: { type: Number, default: 0 },
    showBankDetails: { type: Boolean, default: true },
    showNotes: { type: Boolean, default: true },
    notes: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('RecurringInvoice', recurringInvoiceSchema);