const bcrypt = require('bcryptjs');
const Subscription = require('../models/subscription');
const Company = require('../models/company');
const User = require('../models/user');
const Invoice = require('../models/invoice');
const Sale = require('../models/sale');
const PaymentSettings = require('../models/paymentSettings');
const ActivityLog = require('../models/activityLog');
const PlanConfig = require('../models/planConfig');
const { DEFAULTS: PLAN_DEFAULTS, invalidateCache: invalidatePlanCache } = require('../utils/plans');
const { PLANS, getPlan, getPaidPlanExpiration, getFreePlanExpiration } = require('../utils/plans');
const { sendUpgradeConfirmationEmail } = require('../utils/mailSender');

// ─── STATS (Dashboard) ────────────────────────────────────────────────────────
exports.getDashboardStats = async (req, res) => {
    try {
        const now = new Date();
        const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        const startThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const [
            totalCompanies,
            activeSubs,
            expiredSubs,
            expiringSoon,
            newCompaniesThisMonth,
            planDistribution,
            recentCompanies,
        ] = await Promise.all([
            Company.countDocuments(),
            Subscription.countDocuments({ status: 'active' }),
            Subscription.countDocuments({ status: 'expired' }),
            Subscription.countDocuments({ status: 'active', expiresAt: { $gte: now, $lte: in7Days } }),
            Company.countDocuments({ createdAt: { $gte: startThisMonth } }),
            Subscription.aggregate([
                { $group: { _id: '$plan', count: { $sum: 1 } } },
                { $sort: { _id: 1 } }
            ]),
            Company.find().sort({ createdAt: -1 }).limit(8).select('name email contact createdAt'),
        ]);

        // Receita potencial (subscrições pagas activas)
        const paidSubs = await Subscription.find({
            status: 'active',
            plan: { $in: ['BASIC', 'PREMIUM'] }
        }).select('plan');
        const potentialRevenue = paidSubs.reduce((acc, s) => {
            return acc + (getPlan(s.plan).priceMZN || 0);
        }, 0);

        return res.json({
            success: true,
            stats: {
                totalCompanies,
                activeSubs,
                expiredSubs,
                expiringSoon,
                newCompaniesThisMonth,
                potentialRevenue,
                planDistribution,
                recentCompanies,
            }
        });
    } catch (err) {
        console.error('[Admin] getDashboardStats:', err);
        return res.status(500).json({ success: false, message: 'Erro ao carregar estatísticas.' });
    }
};

// ─── LISTAR TODAS AS SUBSCRIÇÕES ──────────────────────────────────────────────
exports.listSubscriptions = async (req, res) => {
    try {
        const { plan, status, search } = req.query;
        const filter = {};
        if (plan) filter.plan = plan;
        if (status) filter.status = status;

        const subs = await Subscription.find(filter)
            .populate('companyId', 'name email contact nuit')
            .sort({ createdAt: -1 });

        const now = new Date();
        const result = subs
            .filter(s => {
                if (!search) return true;
                const q = search.toLowerCase();
                return s.companyId?.name?.toLowerCase().includes(q) ||
                       s.companyId?.email?.toLowerCase().includes(q);
            })
            .map(s => {
                const rawDays = Math.ceil((s.expiresAt - now) / (1000 * 60 * 60 * 24));
                const daysLeft = Number.isFinite(rawDays) ? Math.max(0, rawDays) : 0;
                return {
                    _id: s._id,
                    companyId: s.companyId?._id,
                    companyName: s.companyId?.name || 'N/A',
                    companyEmail: s.companyId?.email || 'N/A',
                    plan: s.plan,
                    planLabel: getPlan(s.plan).label,
                    status: s.status,
                    startDate: s.startDate,
                    expiresAt: s.expiresAt,
                    daysLeft,
                };
            });

        return res.json({ success: true, subscriptions: result });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Erro ao listar subscrições.' });
    }
};

// ─── ACTIVAR / ALTERAR PLANO ──────────────────────────────────────────────────
exports.activatePlan = async (req, res) => {
    try {
        const { companyId, plan, months } = req.body;

        if (!companyId || !plan || !PLANS[plan]) {
            return res.status(400).json({ success: false, message: 'companyId e plan válido são obrigatórios.' });
        }

        const sub = await Subscription.findOne({ companyId });
        if (!sub) return res.status(404).json({ success: false, message: 'Subscrição não encontrada.' });

        const numMonths = parseInt(months) || 1;
        const expiry = new Date();
        expiry.setDate(expiry.getDate() + numMonths * 30);

        sub.plan = plan;
        sub.status = 'active';
        sub.startDate = new Date();
        sub.expiresAt = expiry;
        await sub.save();

        // Enviar email de confirmação ao admin da empresa
        const company = await Company.findById(companyId);
        const adminUser = await User.findOne({ companyId, role: { $in: ['ADMIN', 'SUPERADMIN'] } });
        if (adminUser && company) {
            await sendUpgradeConfirmationEmail(
                adminUser.email,
                adminUser.name,
                company.name,
                getPlan(plan).label
            );
        }

        return res.json({
            success: true,
            message: `Plano ${plan} activado para ${company?.name || companyId}. Email de confirmação enviado.`,
            subscription: sub
        });
    } catch (err) {
        console.error('[Admin] activatePlan:', err);
        return res.status(500).json({ success: false, message: 'Erro ao activar plano.' });
    }
};

// ─── CANCELAR SUBSCRIÇÃO ──────────────────────────────────────────────────────
exports.cancelSubscription = async (req, res) => {
    try {
        const { companyId } = req.body;
        const sub = await Subscription.findOne({ companyId });
        if (!sub) return res.status(404).json({ success: false, message: 'Subscrição não encontrada.' });

        sub.status = 'cancelled';
        await sub.save();

        return res.json({ success: true, message: 'Subscrição cancelada.' });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Erro ao cancelar subscrição.' });
    }
};

// ─── LISTAR TODAS AS EMPRESAS ─────────────────────────────────────────────────
exports.listCompanies = async (req, res) => {
    try {
        const { search } = req.query;

        const query = search
            ? { $or: [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
              ] }
            : {};

        const companies = await Company.find(query).sort({ createdAt: -1 });

        const companyIds = companies.map(c => c._id);
        const subs = await Subscription.find({ companyId: { $in: companyIds } })
            .select('companyId plan status expiresAt');
        const subsMap = {};
        subs.forEach(s => { subsMap[s.companyId.toString()] = s; });

        const userCounts = await User.aggregate([
            { $match: { companyId: { $in: companyIds } } },
            { $group: { _id: '$companyId', count: { $sum: 1 } } }
        ]);
        const userCountMap = {};
        userCounts.forEach(u => { userCountMap[u._id.toString()] = u.count; });

        const result = companies.map(c => {
            const sub = subsMap[c._id.toString()];
            return {
                _id: c._id,
                name: c.name,
                email: c.email,
                contact: c.contact,
                nuit: c.nuit,
                modules: c.modules,
                createdAt: c.createdAt,
                userCount: userCountMap[c._id.toString()] || 0,
                subscription: sub ? {
                    plan: sub.plan,
                    planLabel: getPlan(sub.plan).label,
                    status: sub.status,
                    expiresAt: sub.expiresAt,
                } : null,
            };
        });

        return res.json({ success: true, companies: result });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Erro ao listar empresas.' });
    }
};

// ─── DETALHE DE UMA EMPRESA ───────────────────────────────────────────────────
exports.getCompanyDetail = async (req, res) => {
    try {
        const { id } = req.params;
        const company = await Company.findById(id);
        if (!company) return res.status(404).json({ success: false, message: 'Empresa não encontrada.' });

        const [sub, users, invoiceCount, saleCount] = await Promise.all([
            Subscription.findOne({ companyId: id }),
            User.find({ companyId: id }).select('name email role status createdAt'),
            Invoice.countDocuments({ companyId: id }),
            Sale.countDocuments({ companyId: id }),
        ]);

        return res.json({
            success: true,
            company,
            subscription: sub,
            users,
            usage: { invoices: invoiceCount, sales: saleCount }
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Erro ao carregar empresa.' });
    }
};

// ─── LISTAR TODOS OS UTILIZADORES ────────────────────────────────────────────
exports.listUsers = async (req, res) => {
    try {
        const { search } = req.query;
        const query = search
            ? { $or: [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
              ] }
            : {};

        const users = await User.find(query)
            .populate('companyId', 'name')
            .select('-password')
            .sort({ createdAt: -1 });

        return res.json({ success: true, users });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Erro ao listar utilizadores.' });
    }
};

// ─── PROMOVER A SUPERADMIN ────────────────────────────────────────────────────
exports.promoteSuperAdmin = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOneAndUpdate(
            { email },
            { $set: { role: 'SUPERADMIN' } },
            { new: true }
        );
        if (!user) return res.status(404).json({ success: false, message: 'Utilizador não encontrado.' });
        return res.json({ success: true, message: `${user.name} promovido a SUPERADMIN.` });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Erro ao promover utilizador.' });
    }
};

// ─── CRIAR SUPERADMIN INDEPENDENTE (sem companyId) ───────────────────────────
exports.createSuperAdmin = async (req, res) => {
    try {
        const existing = await User.findOne({ role: 'SUPERADMIN' });
        if (existing) {
            return res.status(403).json({ success: false, message: 'Já existe um SUPERADMIN. Use a página de login.' });
        }

        const { name, email, password } = req.body;
        if (!name || !email || !password) {
            return res.status(400).json({ success: false, message: 'Nome, email e password são obrigatórios.' });
        }
        if (password.length < 8) {
            return res.status(400).json({ success: false, message: 'A password deve ter pelo menos 8 caracteres.' });
        }

        const existingEmail = await User.findOne({ email });
        if (existingEmail) {
            return res.status(400).json({ success: false, message: 'Este email já está em uso.' });
        }

        const hashedPassword = bcrypt.hashSync(password, 10);
        const superAdmin = new User({
            name,
            email,
            password: hashedPassword,
            role: 'SUPERADMIN',
            companyId: null,
            emailVerified: true,
            status: 'active',
        });
        await superAdmin.save();

        return res.json({ success: true, message: `SUPERADMIN criado com sucesso. Faça login em /login.` });
    } catch (err) {
        console.error('[Admin] createSuperAdmin:', err);
        return res.status(500).json({ success: false, message: 'Erro ao criar SUPERADMIN.' });
    }
};

// ─── SETUP INICIAL (sem autenticação, apenas quando não existe SUPERADMIN) ───
exports.setupSuperAdmin = async (req, res) => {
    try {
        const existing = await User.findOne({ role: 'SUPERADMIN' });
        if (existing) {
            return res.status(403).json({ success: false, message: 'Já existe um SUPERADMIN.' });
        }
        const { email } = req.body;
        const user = await User.findOneAndUpdate(
            { email },
            { $set: { role: 'SUPERADMIN' } },
            { new: true }
        );
        if (!user) return res.status(404).json({ success: false, message: 'Utilizador não encontrado.' });
        return res.json({ success: true, message: `${user.name} definido como SUPERADMIN da plataforma.` });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Erro.' });
    }
};

// ─── PLAN MANAGEMENT ─────────────────────────────────────────────────────────
exports.getPlans = async (req, res) => {
    try {
        const docs = await PlanConfig.find({}).sort({ priceMZN: 1 });
        // If DB is empty, return defaults so the admin can see and edit them
        if (!docs.length) {
            const plans = Object.values(PLAN_DEFAULTS).map(p => ({ ...p, _id: null }));
            return res.json({ success: true, plans, fromDefaults: true });
        }
        res.json({ success: true, plans: docs, fromDefaults: false });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.updatePlan = async (req, res) => {
    try {
        const { name } = req.params;
        if (!['FREE', 'BASIC', 'PREMIUM'].includes(name)) {
            return res.status(400).json({ success: false, message: 'Plano inválido.' });
        }
        const fields = ['label', 'maxInvoicesPerMonth', 'maxSalesPerMonth', 'maxClients',
            'maxProducts', 'maxUsers', 'excelExport', 'advancedReports', 'trialDays', 'priceMZN', 'priceLabel'];
        const update = {};
        for (const f of fields) {
            if (req.body[f] !== undefined) update[f] = req.body[f];
        }

        const plan = await PlanConfig.findOneAndUpdate(
            { name },
            { $set: { ...update, name } },
            { new: true, upsert: true }
        );

        invalidatePlanCache();
        res.json({ success: true, message: `Plano ${name} actualizado.`, plan });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─── ACTIVITIES (all companies) ───────────────────────────────────────────────
exports.getAllActivities = async (req, res) => {
    try {
        const { entity, company, limit = 50 } = req.query;
        const filter = {};
        if (entity) filter.entity = entity;
        if (company) filter.companyId = company;
        const activities = await ActivityLog.find(filter)
            .sort({ createdAt: -1 })
            .limit(Number(limit))
            .populate('companyId', 'name');
        res.json({ success: true, activities });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─── PAYMENT SETTINGS ─────────────────────────────────────────────────────────
exports.getPaymentSettings = async (req, res) => {
    try {
        let settings = await PaymentSettings.findOne();
        if (!settings) settings = await PaymentSettings.create({});
        res.json({ success: true, settings });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.updatePaymentSettings = async (req, res) => {
    try {
        const { mpesa, emola, bankName, bankHolder, bankNIB } = req.body;
        let settings = await PaymentSettings.findOne();
        if (!settings) settings = new PaymentSettings();
        Object.assign(settings, { mpesa, emola, bankName, bankHolder, bankNIB });
        await settings.save();
        res.json({ success: true, message: 'Dados de pagamento actualizados.' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
