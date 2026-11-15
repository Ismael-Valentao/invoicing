const SubscriptionPayment = require('../models/subscriptionPayment');

/**
 * Regista um pagamento de subscrição (histórico de faturação da conta).
 * Nunca lança — se falhar, apenas regista no log, para não bloquear a activação.
 */
async function recordSubscriptionPayment(data = {}) {
    try {
        const year = new Date().getFullYear();
        const n = await SubscriptionPayment.countDocuments({ createdAt: { $gte: new Date(year, 0, 1) } }) + 1;
        const receiptNumber = `RCB-${year}-${String(n).padStart(4, '0')}`;
        return await SubscriptionPayment.create({
            companyId: data.companyId,
            companyName: data.companyName || '',
            receiptNumber,
            plan: data.plan,
            billingCycle: data.billingCycle || 'monthly',
            amountMZN: Number(data.amountMZN) || 0,
            paymentMethod: data.paymentMethod || '',
            paymentRef: data.paymentRef || '',
            periodStart: data.periodStart || new Date(),
            periodEnd: data.periodEnd || null,
            source: data.source || 'manual',
            recordedBy: data.recordedBy || null,
            upgradeRequestId: data.upgradeRequestId || null,
            notes: data.notes || '',
        });
    } catch (e) {
        console.error('[recordSubscriptionPayment] falhou:', e.message);
        return null;
    }
}

module.exports = { recordSubscriptionPayment };
