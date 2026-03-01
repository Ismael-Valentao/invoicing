const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema({
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },
    type: { type: String, required: true }, // saleReceipt, invoice, quotation
    value: { type: Number, default: 0 }
});

counterSchema.index({ companyId: 1, type: 1 }, { unique: true });

module.exports = mongoose.model('Counter', counterSchema);