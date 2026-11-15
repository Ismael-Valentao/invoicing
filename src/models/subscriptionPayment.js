const mongoose = require('mongoose');

/**
 * Pagamento de subscrição — o que a EMPRESA pagou ao Invoicing pelo seu plano.
 * (Diferente do modelo Payment, que são pagamentos dos CLIENTES das empresas.)
 * Registado a cada activação/renovação de plano. Serve de histórico de
 * faturação da conta e base para o recibo descarregável.
 */
const subscriptionPaymentSchema = new mongoose.Schema({
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    companyName: { type: String, default: '' },

    receiptNumber: { type: String, index: true },

    plan: { type: String, enum: ['BASIC', 'PREMIUM'], required: true },
    billingCycle: { type: String, enum: ['monthly', 'annual'], default: 'monthly' },
    amountMZN: { type: Number, default: 0 },

    paymentMethod: { type: String, default: '' },
    paymentRef: { type: String, default: '' },

    periodStart: { type: Date },
    periodEnd: { type: Date },

    source: { type: String, enum: ['upgrade-request', 'admin-activate', 'manual'], default: 'manual' },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    upgradeRequestId: { type: mongoose.Schema.Types.ObjectId, ref: 'UpgradeRequest', default: null },

    notes: { type: String, default: '' },
    date: { type: Date, default: Date.now },
}, { timestamps: true });

subscriptionPaymentSchema.index({ companyId: 1, createdAt: -1 });

module.exports = mongoose.model('SubscriptionPayment', subscriptionPaymentSchema);
