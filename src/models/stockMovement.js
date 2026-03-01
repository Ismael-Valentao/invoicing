const mongoose = require('mongoose');

const stockMovementSchema = new mongoose.Schema({

    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },

    companyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
        required: true
    },

    type: {
        type: String,
        enum: ['IN', 'OUT', 'ADJUST'],
        required: true
    },

    quantity: {
        type: Number,
        required: true
    },

    reason: {
        type: String
    },
    note: {
        type: String,
    },

    reference: {
        model: { type: String },
        id: { type: mongoose.Schema.Types.ObjectId, refPath: "reference.model" }
    },

    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }

}, { timestamps: true });

module.exports = mongoose.model('StockMovement', stockMovementSchema);