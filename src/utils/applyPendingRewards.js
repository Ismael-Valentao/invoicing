const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Aplica quaisquer recompensas pendentes cuja data de activação já passou.
 * Cada recompensa aplicada sobe o plano (se superior) e estende expiresAt.
 * Retorna { applied: n, subscription } — subscription já gravada se mutou.
 */
async function applyPendingRewards(subscription) {
    if (!subscription || !Array.isArray(subscription.pendingRewards) || subscription.pendingRewards.length === 0) {
        return { applied: 0, subscription };
    }

    const now = new Date();
    let applied = 0;

    // Ordenar por activatesAt ascendente para aplicar em cadeia
    const queue = subscription.pendingRewards
        .filter(r => !r.appliedAt && r.activatesAt && new Date(r.activatesAt) <= now)
        .sort((a, b) => new Date(a.activatesAt) - new Date(b.activatesAt));

    for (const reward of queue) {
        const days = reward.days || 30;
        const rewardPlan = reward.plan || 'PREMIUM';

        // Base: se ainda activo, estende a partir do expiresAt actual; senão, a partir de agora
        const base = subscription.expiresAt && new Date(subscription.expiresAt) > now
            ? new Date(subscription.expiresAt)
            : now;

        subscription.expiresAt = new Date(base.getTime() + days * MS_PER_DAY);
        subscription.plan = rewardPlan;
        subscription.status = 'active';
        reward.appliedAt = now;
        applied++;

        // Actualizar Referral.reward.appliedAt (best-effort)
        if (reward.referralId) {
            try {
                const Referral = require('../models/referral');
                await Referral.updateOne(
                    { _id: reward.referralId },
                    { $set: { 'reward.appliedAt': now } }
                );
            } catch (e) { /* best-effort */ }
        }
    }

    if (applied > 0) {
        await subscription.save();
    }

    return { applied, subscription };
}

module.exports = { applyPendingRewards };
