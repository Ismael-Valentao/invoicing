const mongoose = require('mongoose');
const itemSchema = new mongoose.Schema({
    description: { type: String, required: true },
    quantity: { type: Number, required: true },
    unitPrice: { type: Number, required: true },
});

const reciboSchema = new mongoose.Schema({
    docType: { type: String, default: 'recibo' },
    companyName: { type: String, required: true },
    clientName: { type: String, required: true },
    clientNUIT: { type: String, required: true },
    reciboNumber: { type: String, required: true, unique: false },
    date: { type: Date, default: Date.now() },
    items: [itemSchema],
    appliedTax: { type: Number, default: 0.16 },
    subTotal: { type: Number, required: true },
    tax: { type: Number, required: true },
    totalAmount: { type: Number, required: true },
    dueDate: { type: Date },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('Recibo', reciboSchema);