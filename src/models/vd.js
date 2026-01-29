const mongoose = require('mongoose');

const vdSchema = new mongoose.Schema({
    docType: { type: String, default: 'vd' },
    companyName: { type: String, required: true },
    clientName: { type: String, required: true },
    clientNUIT: { type: String, required: true },
    invoiceNumber: { type: String, required: true, unique: false },
    date: { type: Date, default: Date.now() },
    items: [{
        description: { type: String, required: true },
        quantity: { type: Number, required: true },
        unitPrice: { type: Number, required: true }
    }],
    appliedTax: { type: Number, default: 0.16 },
    subTotal: { type: Number, required: true },
    tax: { type: Number, required: true },
    totalAmount: { type: Number, required: true },
    dueDate: { type: Date },
    showNotes: { type: Boolean, default: true },
    showBankDetails: { type: Boolean, default: false },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: ['paid', 'unpaid', 'overdue'], default: 'paid' }
}, { timestamps: true });

module.exports = mongoose.model('VD', vdSchema);