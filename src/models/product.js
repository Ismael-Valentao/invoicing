const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    description: { type: String, required: true },
    quantity: { type: Number, default: 1 },
    unitPrice: { type: Number, required: true },
})

module.exports = mongoose.model('Product', productSchema);