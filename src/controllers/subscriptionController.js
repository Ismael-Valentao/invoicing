const Subscription = require('../models/subscription');
const Company = require('../models/company');
const User = require('../models/user');
const Referral = require('../models/referral');
const { PLANS, getPlan, getPaidPlanExpiration, loadPlans } = require('../utils/plans');
const { sendUpgradeRequestEmail } = require('../utils/mailSender');

/**
 * GET /api/subscriptions/my
 * Retorna a subscrição actual da empresa do utilizador autenticado.
 */
exports.getMySubscription = async (req, res) => {
    try {
        // SUPERADMIN não tem empresa nem subscrição
        if (req.user.role === 'SUPERADMIN') {
            return res.status(404).json({ success: false, message: 'SUPERADMIN não tem subscrição.' });
        }

        const companyId = req.user.company?._id;
        if (!companyId) {
            return res.status(404).json({ success: false, message: 'Empresa não encontrada.' });
        }

        const sub = await Subscription.findOne({ companyId });

        if (!sub) {
            return res.status(404).json({ success: false, message: 'Subscrição não encontrada.' });
        }

        const plan = getPlan(sub.plan);
        const now = new Date();

        // Se expiresAt estiver em falta, corrige e persiste
        if (!sub.expiresAt) {
            const { getFreePlanExpiration } = require('../utils/plans');
            sub.expiresAt = getFreePlanExpiration();
            await sub.save();
        }

        // Verificação de expiração em tempo real (sem esperar cron job)
        if (sub.status === 'active' && sub.expiresAt < now) {
            sub.status = 'expired';
            await sub.save();
        }

        const rawDays = Math.ceil((sub.expiresAt - now) / (1000 * 60 * 60 * 24));
        const daysLeft = Number.isFinite(rawDays) ? Math.max(0, rawDays) : 0;

        res.set('Cache-Control', 'no-store');

        return res.json({
            success: true,
            subscription: {
                plan: sub.plan,
                planLabel: plan.label,
                status: sub.status,
                startDate: sub.startDate,
                expiresAt: sub.expiresAt,
                daysLeft,
                limits: {
                    maxInvoicesPerMonth: plan.maxInvoicesPerMonth === Infinity ? 'Ilimitado' : plan.maxInvoicesPerMonth,
                    maxSalesPerMonth: plan.maxSalesPerMonth === Infinity ? 'Ilimitado' : plan.maxSalesPerMonth,
                    maxClients: plan.maxClients === Infinity ? 'Ilimitado' : plan.maxClients,
                    maxProducts: plan.maxProducts === Infinity ? 'Ilimitado' : plan.maxProducts,
                    maxUsers: plan.maxUsers === Infinity ? 'Ilimitado' : plan.maxUsers,
                    excelExport: plan.excelExport,
                    advancedReports: plan.advancedReports,
                }
            }
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Erro ao obter subscrição.' });
    }
};

/**
 * POST /api/subscriptions/request-upgrade
 * Empresa solicita upgrade de plano. Envia email ao admin e guarda o pedido.
 */
exports.requestUpgrade = async (req, res) => {
    try {
        const { plan, paymentMethod, paymentRef, billingCycle } = req.body;

        if (!plan || !PLANS[plan]) {
            return res.status(400).json({ success: false, message: 'Plano inválido.' });
        }

        if (plan === 'FREE') {
            return res.status(400).json({ success: false, message: 'Não podes fazer upgrade para o plano gratuito.' });
        }

        const companyId = req.user.company._id;
        const company = await Company.findById(companyId);
        const selectedPlan = getPlan(plan);
        const cycle = billingCycle === 'annual' ? 'annual' : 'monthly';
        const price = cycle === 'annual' ? (selectedPlan.priceAnnualMZN || selectedPlan.priceMZN * 10) : selectedPlan.priceMZN;
        const cycleLabel = cycle === 'annual' ? 'Anual' : 'Mensal';

        await sendUpgradeRequestEmail({
            companyName: company.name,
            companyEmail: company.email,
            userName: req.user.name,
            plan: `${selectedPlan.label} (${cycleLabel})`,
            priceMZN: price,
            paymentMethod: paymentMethod || 'Não especificado',
            paymentRef: paymentRef || 'Não especificado'
        });

        return res.json({
            success: true,
            message: 'Pedido de upgrade enviado com sucesso. Activação instantânea após confirmação do pagamento.'
        });
    } catch (err) {
        console.error('Erro ao solicitar upgrade:', err);
        return res.status(500).json({ success: false, message: 'Erro ao processar pedido.' });
    }
};

/**
 * PATCH /api/subscriptions/admin/activate
 * Admin activa manualmente um plano para uma empresa (após confirmar pagamento).
 */
exports.adminActivatePlan = async (req, res) => {
    try {
        const { companyId, plan } = req.body;

        if (!companyId || !plan || !PLANS[plan]) {
            return res.status(400).json({ success: false, message: 'companyId e plan são obrigatórios.' });
        }

        const sub = await Subscription.findOne({ companyId });
        if (!sub) {
            return res.status(404).json({ success: false, message: 'Subscrição não encontrada.' });
        }

        const wasFreePlan = sub.plan === 'FREE';

        sub.plan = plan;
        sub.status = 'active';
        sub.startDate = new Date();
        sub.expiresAt = getPaidPlanExpiration();
        await sub.save();

        // Trigger de conversão de indicação: só no primeiro upgrade de FREE para pago
        if (wasFreePlan && plan !== 'FREE') {
            try {
                const referral = await Referral.findOne({ refereeCompanyId: companyId, status: 'pending' });
                if (referral) {
                    const referrerSub = await Subscription.findOne({ companyId: referral.referrerCompanyId });
                    if (referrerSub) {
                        const now = new Date();
                        const activatesAt = referrerSub.status === 'active' && referrerSub.expiresAt && new Date(referrerSub.expiresAt) > now
                            ? new Date(referrerSub.expiresAt)
                            : now;

                        referrerSub.pendingRewards = referrerSub.pendingRewards || [];
                        referrerSub.pendingRewards.push({
                            plan: 'PREMIUM',
                            days: 30,
                            activatesAt,
                            appliedAt: null,
                            referralId: referral._id
                        });
                        await referrerSub.save();

                        referral.status = 'converted';
                        referral.convertedAt = now;
                        referral.reward = {
                            plan: 'PREMIUM',
                            days: 30,
                            activatesAt,
                            appliedAt: null
                        };
                        await referral.save();
                    }
                }
            } catch (e) { console.error('[referral conversion]', e.message); }
        }

        const company = await Company.findById(companyId);

        return res.json({
            success: true,
            message: `Plano ${plan} activado para ${company?.name || companyId}.`,
            subscription: sub
        });
    } catch (err) {
        console.error('Erro ao activar plano:', err);
        return res.status(500).json({ success: false, message: 'Erro ao activar plano.' });
    }
};

/**
 * GET /api/subscriptions/admin/all
 * Admin lista todas as subscrições com info da empresa.
 */
exports.adminListSubscriptions = async (req, res) => {
    try {
        const subs = await Subscription.find().populate('companyId', 'name email contact');
        return res.json({ success: true, subscriptions: subs });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Erro ao listar subscrições.' });
    }
};

/**
 * GET /api/subscriptions/plans
 * Lista pública dos planos disponíveis.
 */
exports.getPlans = async (req, res) => {
    await loadPlans();
    const plans = Object.values(PLANS).map(p => ({
        name: p.name,
        label: p.label,
        priceLabel: p.priceLabel,
        priceMZN: p.priceMZN,
        priceAnnualLabel: p.priceAnnualLabel || '',
        priceAnnualMZN: p.priceAnnualMZN || 0,
        limits: {
            maxInvoicesPerMonth: p.maxInvoicesPerMonth === Infinity ? 'Ilimitado' : p.maxInvoicesPerMonth,
            maxSalesPerMonth: p.maxSalesPerMonth === Infinity ? 'Ilimitado' : p.maxSalesPerMonth,
            maxClients: p.maxClients === Infinity ? 'Ilimitado' : p.maxClients,
            maxProducts: p.maxProducts === Infinity ? 'Ilimitado' : p.maxProducts,
            maxUsers: p.maxUsers === Infinity ? 'Ilimitado' : p.maxUsers,
            excelExport: p.excelExport,
            advancedReports: p.advancedReports,
        }
    }));
    return res.json({ success: true, plans });
};