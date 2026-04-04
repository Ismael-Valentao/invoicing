const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
    description: { type: String, required: true },
    quantity: { type: Number, required: true },
    unitPrice: { type: Number, required: true },
}, { _id: false });

const invoiceTemplateSchema = new mongoose.Schema({
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    name: { type: String, required: true },
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client' },
    clientName: { type: String },
    clientNUIT: { type: String },
    items: [itemSchema],
    notes: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('InvoiceTemplate', invoiceTemplateSchema);
