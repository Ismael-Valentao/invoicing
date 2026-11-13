const mongoose = require('mongoose');

/**
 * Pedido de upgrade/renovação de plano feito por uma empresa.
 * Persistido como fonte de verdade — não depende do email de notificação.
 * O pagamento é confirmado fora da plataforma; o SUPERADMIN activa manualmente.
 */
const upgradeRequestSchema = new mongoose.Schema({
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    companyName: { type: String, default: '' },
    companyEmail: { type: String, default: '' },

    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    userName: { type: String, default: '' },

    plan: { type: String, enum: ['BASIC', 'PREMIUM'], required: true },
    billingCycle: { type: String, enum: ['monthly', 'annual'], default: 'monthly' },
    priceMZN: { type: Number, default: 0 },

    paymentMethod: { type: String, default: '' },
    paymentRef: { type: String, default: '' },

    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    handledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    handledAt: { type: Date, default: null },
    adminNotes: { type: String, default: '' },
}, { timestamps: true });

upgradeRequestSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('UpgradeRequest', upgradeRequestSchema);
