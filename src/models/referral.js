const mongoose = require('mongoose');

const referralSchema = new mongoose.Schema({
    code: { type: String, required: true, index: true },

    referrerCompanyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
        required: true,
        index: true
    },
    refereeCompanyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
        required: true,
        unique: true
    },
    refereeUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    status: {
        type: String,
        enum: ['pending', 'converted', 'expired'],
        default: 'pending',
        index: true
    },

    convertedAt: { type: Date, default: null },

    reward: {
        plan: { type: String, default: 'PREMIUM' },
        days: { type: Number, default: 30 },
        activatesAt: { type: Date, default: null },
        appliedAt: { type: Date, default: null }
    }
}, { timestamps: true });

module.exports = mongoose.model('Referral', referralSchema);
