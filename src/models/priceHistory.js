const mongoose = require('mongoose');

const priceHistorySchema = new mongoose.Schema({
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    oldPrice: { type: Number, required: true },
    newPrice: { type: Number, required: true },
    oldCostPrice: { type: Number },
    newCostPrice: { type: Number },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('PriceHistory', priceHistorySchema);
