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
    }

}, {
    timestamps: true
});

module.exports = mongoose.model('Subscription', subscriptionSchema);
