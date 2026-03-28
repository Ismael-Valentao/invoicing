const Subscription = require('../models/subscription');
const Company = require('../models/company');
const User = require('../models/user');
const { PLANS, getPlan, getPaidPlanExpiration } = require('../utils/plans');
const { sendUpgradeRequestEmail } = require('../utils/mailSender');

/**
 * GET /api/subscriptions/my
 * Retorna a subscrição actual da empresa do utilizador autenticado.
 */
exports.getMySubscription = async (req, res) => {
    try {
        const companyId = req.user.company._id;
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

        const rawDays = Math.ceil((sub.expiresAt - now) / (1000 * 60 * 60 * 24));
        const daysLeft = Number.isFinite(rawDays) ? Math.max(0, rawDays) : 0;

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
        const { plan, paymentMethod, paymentRef } = req.body;

        if (!plan || !PLANS[plan]) {
            return res.status(400).json({ success: false, message: 'Plano inválido.' });
        }

        if (plan === 'FREE') {
            return res.status(400).json({ success: false, message: 'Não podes fazer upgrade para o plano gratuito.' });
        }

        const companyId = req.user.company._id;
        const company = await Company.findById(companyId);
        const selectedPlan = getPlan(plan);

        await sendUpgradeRequestEmail({
            companyName: company.name,
            companyEmail: company.email,
            userName: req.user.name,
            plan: selectedPlan.label,
            priceMZN: selectedPlan.priceMZN,
            paymentMethod: paymentMethod || 'Não especificado',
            paymentRef: paymentRef || 'Não especificado'
        });

        return res.json({
            success: true,
            message: 'Pedido de upgrade enviado com sucesso. Activaremos o teu plano em até 24 horas após confirmação do pagamento.'
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

        sub.plan = plan;
        sub.status = 'active';
        sub.startDate = new Date();
        sub.expiresAt = getPaidPlanExpiration();
        await sub.save();

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
exports.getPlans = (req, res) => {
    const plans = Object.values(PLANS).map(p => ({
        name: p.name,
        label: p.label,
        priceLabel: p.priceLabel,
        priceMZN: p.priceMZN,
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