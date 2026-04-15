const Referral = require('../models/referral');
const Company = require('../models/company');
const Subscription = require('../models/subscription');
const { ensureCompanyReferralCode } = require('../utils/referralCode');

function buildShareLink(req, code) {
    const proto = req.protocol;
    const host = req.get('host');
    return `${proto}://${host}/register?ref=${code}`;
}

/**
 * GET /api/referrals/me
 * Devolve código, link, estatísticas e lista de indicações da empresa do utilizador.
 */
exports.getMyReferrals = async (req, res) => {
    try {
        const companyId = req.user.company?._id;
        if (!companyId) return res.status(404).json({ success: false, message: 'Empresa não encontrada.' });

        const code = await ensureCompanyReferralCode(companyId);
        const link = buildShareLink(req, code);

        const referrals = await Referral.find({ referrerCompanyId: companyId })
            .populate('refereeCompanyId', 'name email')
            .sort({ createdAt: -1 })
            .lean();

        const total = referrals.length;
        const converted = referrals.filter(r => r.status === 'converted').length;
        const pending = referrals.filter(r => r.status === 'pending').length;
        const daysEarned = referrals
            .filter(r => r.status === 'converted')
            .reduce((acc, r) => acc + (r.reward?.days || 0), 0);

        const sub = await Subscription.findOne({ companyId }).lean();
        const pendingRewards = (sub?.pendingRewards || [])
            .filter(r => !r.appliedAt)
            .map(r => ({
                plan: r.plan,
                days: r.days,
                activatesAt: r.activatesAt
            }));

        return res.json({
            success: true,
            code,
            link,
            stats: { total, converted, pending, daysEarned },
            pendingRewards,
            referrals: referrals.map(r => ({
                id: r._id,
                status: r.status,
                createdAt: r.createdAt,
                convertedAt: r.convertedAt,
                refereeName: r.refereeCompanyId?.name || '—',
                refereeEmail: r.refereeCompanyId?.email || '—',
                rewardDays: r.reward?.days || 0,
                rewardActivatesAt: r.reward?.activatesAt || null,
                rewardAppliedAt: r.reward?.appliedAt || null
            }))
        });
    } catch (err) {
        console.error('[getMyReferrals]', err);
        return res.status(500).json({ success: false, message: 'Erro ao obter indicações.' });
    }
};

/**
 * GET /api/referrals/validate/:code
 * Validação pública (sem auth) — usada pelo registo para confirmar que o código existe.
 */
exports.validateCode = async (req, res) => {
    try {
        const raw = String(req.params.code || '').trim().toUpperCase();
        if (!raw) return res.json({ success: true, valid: false });
        const c = await Company.findOne({ referralCode: raw }).select('name referralCode').lean();
        if (!c) return res.json({ success: true, valid: false });
        return res.json({ success: true, valid: true, referrerName: c.name });
    } catch (err) {
        return res.json({ success: true, valid: false });
    }
};
