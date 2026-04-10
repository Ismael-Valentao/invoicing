const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    companyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
        required: true
    },

    description: {
        type: String,
        required: true
    },

    type: {
        type: String,
        enum: ['product', 'service'],
        default: 'product'
    },

    sku: {
        type: String
    },

    unitPrice: {
        type: Number,
        required: true
    },

    costPrice: {
        type: Number,
        default: 0
    },

    barcode: {
        type: String,
        default: ''
    },

    category: {
        type: String,
        default: ''
    },

    stock: {
        quantity: {
            type: Number,
            default: 0
        },
        min: {
            type: Number,
            default: 0
        }
    },

    unit: {
        type: String,
        enum: ['un', 'kg', 'lt', 'cx'],
        default: 'un'
    },

    expiryDate: {
        type: Date,
        default: null
    },

    expiryAlertDays: {
        type: Number,
        default: 30
    },

    active: {
        type: Boolean,
        default: true
    }

}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);