const mongoose = require('mongoose');

const bankDetailsSchema = new mongoose.Schema({
    label: { type: String, default: '' },
    bank: { type: String, required: true },
    account_name: { type: String, required: true },
    nib: { type: String, required: true },
    nuib: { type: String, default: '' },
    account_number: { type: String, required: true },
    isPrimary: { type: Boolean, default: false }
}, { _id: true });

const showBankDetailsSchema = new mongoose.Schema({
    invoices: { type: Boolean, default: false },
    quotations: { type: Boolean, default: false },
    receipts: { type: Boolean, default: false },
    vds: { type: Boolean, default: false }
}, { _id: false });

const companySchema = new mongoose.Schema({
    name: { type: String, required: true },
    address: { type: String, required: true },
    contact: { type: String, required: true },
    email: { type: String, required: true },
    nuit: { type: String, required: true, default: 'N/A' },
    showBankDetails: showBankDetailsSchema,
    logoUrl: { type: String },

    bankDetails: {
        type: [bankDetailsSchema],
        default: []
    },

    modules: {
        sales: {
            type: Boolean,
            default: false
        },
        invoicing: {
            type: Boolean,
            default: false
        }
    },

    currency: { type: String, enum: ['MZN', 'USD', 'ZAR', 'EUR'], default: 'MZN' },

    invoiceTemplate: { type: String, enum: ['classic', 'modern', 'minimal'], default: 'classic' }
}, {
    timestamps: true,
});

module.exports = mongoose.model('Company', companySchema);