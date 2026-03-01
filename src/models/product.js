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

    sku: {
        type: String
    },

    unitPrice: {
        type: Number,
        required: true
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

    active: {
        type: Boolean,
        default: true
    }

}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);