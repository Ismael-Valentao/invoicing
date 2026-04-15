const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
    companyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
        required: true,
        unique: true // 1 subscrição ativa por empresa
    },

    plan: {
        type: String,
        enum: ['FREE', 'BASIC', 'PREMIUM'],
        required: true,
        default: 'FREE'
    },

    billingCycle: {
        type: String,
        enum: ['monthly', 'annual'],
        default: 'monthly'
    },

    startDate: {
        type: Date,
        default: Date.now
    },

    expiresAt: {
        type: Date,
        required: true
    },

    status: {
        type: String,
        enum: ['active', 'expired', 'cancelled'],
        default: 'active'
    },

    pendingRewards: [{
        plan: { type: String, enum: ['BASIC', 'PREMIUM'], default: 'PREMIUM' },
        days: { type: Number, default: 30 },
        activatesAt: { type: Date, required: true },
        appliedAt: { type: Date, default: null },
        referralId: { type: mongoose.Schema.Types.ObjectId, ref: 'Referral' }
    }]

}, {
    timestamps: true
});

module.exports = mongoose.model('Subscription', subscriptionSchema);
