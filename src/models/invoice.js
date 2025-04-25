const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
    description: { type: String, required: true },
    quantity: { type: Number, required: true },
    unitPrice: { type: Number, required: true },
})

const invoiceSchema = new mongoose.Schema({
    companyName: { type: String, required: true },
    clientName: { type: String, required: true },
    clientNUIT: { type: String, required: true },
    invoiceNumber: { type: String, required: true, unique: true },
    date: { type: Date, default: Date.now },
    items: [itemSchema],
    subTotal: { type: Number, required: true },
    tax: { type: Number, required: true },
    totalAmount: { type: Number, required: true },
    dueDate: { type: Date, },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: ['paid', 'unpaid', 'overdue'], default: 'unpaid' }, default: 'unpaid'
}, {
    timestamps: true,
})

module.exports = mongoose.model('Invoice', invoiceSchema);