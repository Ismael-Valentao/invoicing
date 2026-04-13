const mongoose = require('mongoose');

const planConfigSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true, enum: ['FREE', 'BASIC', 'PREMIUM'] },
    label: { type: String, required: true },
    maxInvoicesPerMonth: { type: Number, default: 5 },
    maxSalesPerMonth: { type: Number, default: 10 },
    maxClients: { type: Number, default: 10 },
    maxProducts: { type: Number, default: 15 },
    maxUsers: { type: Number, default: 1 },
    excelExport: { type: Boolean, default: false },
    advancedReports: { type: Boolean, default: false },
    trialDays: { type: Number, default: 0 },
    priceMZN: { type: Number, default: 0 },
    priceLabel: { type: String, default: '' },
    priceAnnualMZN: { type: Number, default: 0 },
    priceAnnualLabel: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('PlanConfig', planConfigSchema);
