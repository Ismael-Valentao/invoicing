const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Subscription = require('../models/subscription');
const Company = require('../models/company');
const User = require('../models/user');
const Invoice = require('../models/invoice');
const Sale = require('../models/sale');
const Quotation = require('../models/quotation');
const Product = require('../models/product');
const Client = require('../models/client');
const Supplier = require('../models/supplier');
const Expense = require('../models/expense');
const Recibo = require('../models/recibo');
const VD = require('../models/vd');
const Payment = require('../models/payment');
const PaymentSettings = require('../models/paymentSettings');
const ActivityLog = require('../models/activityLog');
const PlanConfig = require('../models/planConfig');
const LoginAudit = require('../models/loginAudit');
const SystemSetting = require('../models/systemSetting');
const ErrorLog = require('../models/errorLog');
const EmailTemplate = require('../models/emailTemplate');
const Release = require('../models/release');
const { DEFAULTS: PLAN_DEFAULTS, invalidateCache: invalidatePlanCache } = require('../utils/plans');
const { PLANS, getPlan, getPaidPlanExpiration, getFreePlanExpiration } = require('../utils/plans');
const { sendUpgradeConfirmationEmail, sendGeneric, sendForcedPasswordResetEmail } = require('../utils/mailSender');
const { logError } = require('../middlewares/errorLogger');

const JWT_SECRET = process.env.JWT_SECRET;
const APP_URL = process.env.APP_URL || process.env.BASE_URL || '';

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

        const [
            sub, users,
            invoiceCount, saleCount, quotationCount,
            productCount, serviceCount,
            clientCount, supplierCount,
            expenseCount, reciboCount, vdCount,
            creditNoteCount, debitNoteCount
        ] = await Promise.all([
            Subscription.findOne({ companyId: id }),
            User.find({ companyId: id }).select('name email role status createdAt'),
            Invoice.countDocuments({ companyId: id, docType: 'invoice' }),
            Sale.countDocuments({ companyId: id }),
            Quotation.countDocuments({ companyId: id }),
            Product.countDocuments({ companyId: id, type: { $ne: 'service' } }),
            Product.countDocuments({ companyId: id, type: 'service' }),
            Client.countDocuments({ companyId: id }),
            Supplier.countDocuments({ companyId: id }),
            Expense.countDocuments({ companyId: id }),
            Recibo.countDocuments({ companyId: id }),
            VD.countDocuments({ companyId: id }),
            Invoice.countDocuments({ companyId: id, docType: 'credit_note' }),
            Invoice.countDocuments({ companyId: id, docType: 'debit_note' }),
        ]);

        return res.json({
            success: true,
            company,
            subscription: sub,
            users,
            usage: {
                invoices: invoiceCount,
                sales: saleCount,
                quotations: quotationCount,
                products: productCount,
                services: serviceCount,
                clients: clientCount,
                suppliers: supplierCount,
                expenses: expenseCount,
                recibos: reciboCount,
                vds: vdCount,
                creditNotes: creditNoteCount,
                debitNotes: debitNoteCount,
            }
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

// ─── BLOQUEAR / DESBLOQUEAR UTILIZADOR ───────────────────────────────────────
exports.setUserStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body; // 'active' | 'blocked'

        if (!['active', 'blocked'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Estado inválido. Use "active" ou "blocked".' });
        }

        const user = await User.findById(id);
        if (!user) return res.status(404).json({ success: false, message: 'Utilizador não encontrado.' });

        if (user.role === 'SUPERADMIN') {
            return res.status(403).json({ success: false, message: 'Não é possível bloquear um SUPERADMIN.' });
        }

        user.status = status;
        await user.save();

        return res.json({
            success: true,
            message: status === 'blocked'
                ? `${user.name} foi bloqueado.`
                : `${user.name} foi desbloqueado.`,
            user: { _id: user._id, name: user.name, email: user.email, status: user.status }
        });
    } catch (err) {
        console.error('[Admin] setUserStatus:', err);
        return res.status(500).json({ success: false, message: 'Erro ao actualizar estado do utilizador.' });
    }
};

// ─── BLOQUEAR / DESBLOQUEAR EMPRESA INTEIRA ──────────────────────────────────
exports.setCompanyStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body; // 'active' | 'blocked'

        if (!['active', 'blocked'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Estado inválido.' });
        }

        const company = await Company.findById(id);
        if (!company) return res.status(404).json({ success: false, message: 'Empresa não encontrada.' });

        // Bloqueia/desbloqueia todos os utilizadores não-SUPERADMIN da empresa
        const result = await User.updateMany(
            { companyId: id, role: { $ne: 'SUPERADMIN' } },
            { $set: { status } }
        );

        return res.json({
            success: true,
            message: status === 'blocked'
                ? `${company.name} bloqueada (${result.modifiedCount} utilizadores afectados).`
                : `${company.name} desbloqueada (${result.modifiedCount} utilizadores afectados).`,
        });
    } catch (err) {
        console.error('[Admin] setCompanyStatus:', err);
        return res.status(500).json({ success: false, message: 'Erro ao actualizar estado da empresa.' });
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
        const docs = await PlanConfig.find({});
        const dbMap = {};
        for (const doc of docs) dbMap[doc.name] = doc.toObject();

        // Always return all 3 plans, merging DB values over defaults
        const plans = ['FREE', 'BASIC', 'PREMIUM'].map(name => {
            return dbMap[name] || { ...PLAN_DEFAULTS[name], _id: null };
        });

        res.json({ success: true, plans });
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

// ═════════════════════════════════════════════════════════════════════════════
//  COMPANIES — edit, delete, extend trial, change plan, wipe test data
// ═════════════════════════════════════════════════════════════════════════════

exports.updateCompany = async (req, res) => {
    try {
        const { id } = req.params;
        const allowed = ['name', 'email', 'contact', 'nuit', 'address', 'currency'];
        const update = {};
        for (const f of allowed) if (req.body[f] !== undefined) update[f] = req.body[f];

        const company = await Company.findByIdAndUpdate(id, { $set: update }, { new: true });
        if (!company) return res.status(404).json({ success: false, message: 'Empresa não encontrada.' });
        return res.json({ success: true, message: 'Empresa actualizada.', company });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

exports.deleteCompany = async (req, res) => {
    try {
        const { id } = req.params;
        const { hard } = req.query; // ?hard=true → apaga tudo

        if (hard === 'true') {
            // Hard delete: apaga todos os dados da empresa
            await Promise.all([
                Invoice.deleteMany({ companyId: id }),
                Sale.deleteMany({ companyId: id }),
                Quotation.deleteMany({ companyId: id }),
                Product.deleteMany({ companyId: id }),
                Client.deleteMany({ companyId: id }),
                Supplier.deleteMany({ companyId: id }),
                Expense.deleteMany({ companyId: id }),
                Recibo.deleteMany({ companyId: id }),
                VD.deleteMany({ companyId: id }),
                Payment.deleteMany({ companyId: id }),
                Subscription.deleteMany({ companyId: id }),
                User.deleteMany({ companyId: id, role: { $ne: 'SUPERADMIN' } }),
                ActivityLog.deleteMany({ companyId: id }),
                Company.deleteOne({ _id: id }),
            ]);
            return res.json({ success: true, message: 'Empresa e todos os seus dados foram apagados permanentemente.' });
        }

        // Soft delete: apenas bloqueia utilizadores e marca subscrição como cancelada
        await User.updateMany({ companyId: id, role: { $ne: 'SUPERADMIN' } }, { $set: { status: 'blocked' } });
        await Subscription.updateMany({ companyId: id }, { $set: { status: 'cancelled' } });
        return res.json({ success: true, message: 'Empresa desactivada (utilizadores bloqueados, subscrição cancelada).' });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

exports.extendSubscription = async (req, res) => {
    try {
        const companyId = req.params.id || req.params.companyId;
        const { days } = req.body;
        const d = parseInt(days);
        if (!Number.isFinite(d) || d === 0) {
            return res.status(400).json({ success: false, message: 'days deve ser um inteiro não-zero.' });
        }
        const sub = await Subscription.findOne({ companyId });
        if (!sub) return res.status(404).json({ success: false, message: 'Subscrição não encontrada.' });

        const base = sub.expiresAt && sub.expiresAt > new Date() ? sub.expiresAt : new Date();
        const newExpiry = new Date(base);
        newExpiry.setDate(newExpiry.getDate() + d);
        sub.expiresAt = newExpiry;
        if (d > 0 && sub.status === 'expired') sub.status = 'active';
        await sub.save();

        return res.json({ success: true, message: `Subscrição estendida em ${d} dias.`, subscription: sub });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

exports.changePlanKeepExpiry = async (req, res) => {
    try {
        const companyId = req.params.id || req.params.companyId;
        const { plan } = req.body;
        if (!PLANS[plan]) return res.status(400).json({ success: false, message: 'Plano inválido.' });

        const sub = await Subscription.findOne({ companyId });
        if (!sub) return res.status(404).json({ success: false, message: 'Subscrição não encontrada.' });

        sub.plan = plan;
        await sub.save();
        return res.json({ success: true, message: `Plano alterado para ${plan} (data de expiração mantida).`, subscription: sub });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

exports.wipeCompanyData = async (req, res) => {
    try {
        const { id } = req.params;
        await Promise.all([
            Invoice.deleteMany({ companyId: id }),
            Sale.deleteMany({ companyId: id }),
            Quotation.deleteMany({ companyId: id }),
            Expense.deleteMany({ companyId: id }),
            Recibo.deleteMany({ companyId: id }),
            VD.deleteMany({ companyId: id }),
            Payment.deleteMany({ companyId: id }),
            ActivityLog.deleteMany({ companyId: id }),
        ]);
        return res.json({ success: true, message: 'Dados transaccionais apagados (empresa, utilizadores e produtos mantidos).' });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

exports.exportCompanyData = async (req, res) => {
    try {
        const { id } = req.params;
        const company = await Company.findById(id).lean();
        if (!company) return res.status(404).json({ success: false, message: 'Empresa não encontrada.' });

        const [users, sub, invoices, sales, quotations, products, clients, suppliers, expenses, recibos, vds, payments] = await Promise.all([
            User.find({ companyId: id }).select('-password').lean(),
            Subscription.findOne({ companyId: id }).lean(),
            Invoice.find({ companyId: id }).lean(),
            Sale.find({ companyId: id }).lean(),
            Quotation.find({ companyId: id }).lean(),
            Product.find({ companyId: id }).lean(),
            Client.find({ companyId: id }).lean(),
            Supplier.find({ companyId: id }).lean(),
            Expense.find({ companyId: id }).lean(),
            Recibo.find({ companyId: id }).lean(),
            VD.find({ companyId: id }).lean(),
            Payment.find({ companyId: id }).lean(),
        ]);

        const filename = `export-${company.name?.replace(/\s+/g, '-')}-${Date.now()}.json`;
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        return res.send(JSON.stringify({
            exportedAt: new Date().toISOString(),
            company, subscription: sub, users,
            invoices, sales, quotations, products, clients, suppliers,
            expenses, recibos, vds, payments
        }, null, 2));
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
//  USERS — force logout, forced password reset
// ═════════════════════════════════════════════════════════════════════════════

exports.forceLogoutUser = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await User.findByIdAndUpdate(id, { $inc: { tokenVersion: 1 } }, { new: true });
        if (!user) return res.status(404).json({ success: false, message: 'Utilizador não encontrado.' });
        return res.json({ success: true, message: `${user.name} foi desconectado de todas as sessões.` });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

exports.forceLogoutCompany = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await User.updateMany({ companyId: id }, { $inc: { tokenVersion: 1 } });
        return res.json({ success: true, message: `${result.modifiedCount} utilizadores desconectados.` });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

exports.forcePasswordReset = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await User.findById(id);
        if (!user) return res.status(404).json({ success: false, message: 'Utilizador não encontrado.' });

        const token = crypto.randomBytes(32).toString('hex');
        user.passwordResetToken = token;
        user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1h
        user.mustChangePassword = true;
        user.tokenVersion = (user.tokenVersion || 0) + 1; // logout forçado
        await user.save();

        const base = APP_URL || `${req.protocol}://${req.get('host')}`;
        const resetUrl = `${base.replace(/\/$/, '')}/reset-password/${token}`;

        let emailSent = true;
        try {
            await sendForcedPasswordResetEmail(user.email, user.name, resetUrl);
        } catch (e) {
            emailSent = false;
            console.error('[Admin] forcePasswordReset email:', e.message);
        }

        return res.json({
            success: true,
            message: emailSent
                ? `Email de redefinição enviado para ${user.email}.`
                : `Token gerado mas falhou o envio do email para ${user.email}.`
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
//  IMPERSONATE — SUPERADMIN entra na conta de outro utilizador
// ═════════════════════════════════════════════════════════════════════════════

exports.impersonate = async (req, res) => {
    try {
        const { userId } = req.body;
        const target = await User.findById(userId).populate('companyId');
        if (!target) return res.status(404).json({ success: false, message: 'Utilizador não encontrado.' });
        if (target.role === 'SUPERADMIN') {
            return res.status(403).json({ success: false, message: 'Não é possível impersonar outro SUPERADMIN.' });
        }

        // Token curto (30min) com flag de impersonação e identidade original
        const token = jwt.sign({
            id: target._id,
            name: target.name,
            email: target.email,
            permissions: target.permissions,
            role: target.role,
            company: target.companyId,
            tokenVersion: target.tokenVersion || 0,
            impersonatedBy: req.user.id,
        }, JWT_SECRET, { expiresIn: '30m' });

        // Log crítico
        ActivityLog.create({
            companyId: target.companyId?._id || null,
            userId: req.user.id,
            userName: req.user.name,
            action: 'impersonate',
            entity: 'user',
            entityId: target._id,
            description: `SUPERADMIN ${req.user.name} entrou como ${target.name} (${target.email}).`
        }).catch(() => {});

        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
            maxAge: 30 * 60 * 1000,
        });

        return res.json({ success: true, message: `A entrar como ${target.name}...`, redirect: '/dashboard' });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

// Termina sessão de impersonação e devolve cookie ao SUPERADMIN original
exports.stopImpersonate = async (req, res) => {
    try {
        // Esta rota corre com authMiddleware (já foi validado), e req.user vem do JWT actual
        // que pode ser o de impersonação. Lemos directamente do token sem passar pelo requireSuperAdmin
        // (a rota é montada antes do require — ver routes/admin.js).
        const decoded = req.user;
        if (!decoded?.impersonatedBy) {
            return res.status(400).json({ success: false, message: 'Não está em modo impersonação.' });
        }

        const original = await User.findById(decoded.impersonatedBy).populate('companyId');
        if (!original || original.role !== 'SUPERADMIN') {
            return res.status(403).json({ success: false, message: 'Sessão original inválida.' });
        }

        const token = jwt.sign({
            id: original._id,
            name: original.name,
            email: original.email,
            permissions: original.permissions,
            role: original.role,
            company: original.companyId,
            tokenVersion: original.tokenVersion || 0,
        }, JWT_SECRET, { expiresIn: '1h' });

        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
            maxAge: 3600000,
        });

        return res.json({ success: true, message: 'Voltaste à tua sessão SUPERADMIN.', redirect: '/admin' });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
//  BUSINESS INSIGHTS — MRR, churn, top, inactive, growth, conversion, funnel
// ═════════════════════════════════════════════════════════════════════════════

exports.getBusinessMetrics = async (req, res) => {
    try {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), 1);
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        // MRR — subscrições pagas activas
        const activePaidSubs = await Subscription.find({
            status: 'active',
            plan: { $in: ['BASIC', 'PREMIUM'] }
        }).lean();
        const mrr = activePaidSubs.reduce((acc, s) => acc + (getPlan(s.plan).priceMZN || 0), 0);
        const arr = mrr * 12;

        // Churn (cancelled + expired nos últimos 30d)
        const churned = await Subscription.countDocuments({
            status: { $in: ['cancelled', 'expired'] },
            updatedAt: { $gte: thirtyDaysAgo }
        });
        const totalActive30d = await Subscription.countDocuments({ createdAt: { $lt: thirtyDaysAgo } });
        const churnRate = totalActive30d > 0 ? (churned / totalActive30d) * 100 : 0;

        // Crescimento mensal (últimos 12 meses)
        const monthlyGrowth = await Company.aggregate([
            { $match: { createdAt: { $gte: oneYearAgo } } },
            { $group: {
                _id: { y: { $year: '$createdAt' }, m: { $month: '$createdAt' } },
                count: { $sum: 1 }
            }},
            { $sort: { '_id.y': 1, '_id.m': 1 } }
        ]);

        // Conversão FREE → BASIC/PREMIUM
        const totalCompanies = await Company.countDocuments();
        const paidCount = await Subscription.countDocuments({ plan: { $in: ['BASIC', 'PREMIUM'] } });
        const conversionRate = totalCompanies > 0 ? (paidCount / totalCompanies) * 100 : 0;

        // Funil de onboarding
        const [withCompany, withFirstDoc, withPayment] = await Promise.all([
            Company.countDocuments(),
            Invoice.distinct('companyId').then(a => a.length),
            Subscription.countDocuments({ plan: { $in: ['BASIC', 'PREMIUM'] }, status: 'active' }),
        ]);
        const totalUsers = await User.countDocuments({ role: { $ne: 'SUPERADMIN' } });

        return res.json({
            success: true,
            metrics: {
                mrr, arr,
                churnRate: Number(churnRate.toFixed(2)),
                conversionRate: Number(conversionRate.toFixed(2)),
                monthlyGrowth,
                funnel: {
                    registered: totalUsers,
                    withCompany,
                    withFirstDoc,
                    withPayment,
                }
            }
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

exports.getTopCompanies = async (req, res) => {
    try {
        const limit = Math.min(Number(req.query.limit) || 10, 50);
        const agg = await Invoice.aggregate([
            { $group: { _id: '$companyId', invoiceCount: { $sum: 1 }, revenue: { $sum: '$totalAmount' } } },
            { $sort: { invoiceCount: -1 } },
            { $limit: limit },
        ]);
        const companyIds = agg.map(a => a._id);
        const companies = await Company.find({ _id: { $in: companyIds } }).select('name email').lean();
        const byId = new Map(companies.map(c => [String(c._id), c]));

        const result = agg.map(a => ({
            companyId: a._id,
            companyName: byId.get(String(a._id))?.name || '—',
            companyEmail: byId.get(String(a._id))?.email || '',
            invoiceCount: a.invoiceCount,
            revenue: a.revenue,
        }));
        return res.json({ success: true, top: result });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

exports.getInactiveCompanies = async (req, res) => {
    try {
        const days = Math.max(Number(req.query.days) || 30, 1);
        const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        // Empresas sem nenhuma actividade após cutoff
        const activeIds = await ActivityLog.distinct('companyId', { createdAt: { $gte: cutoff } });
        const inactive = await Company.find({
            _id: { $nin: activeIds }
        }).select('name email createdAt').lean();

        return res.json({ success: true, days, inactive });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

exports.getChurnRisk = async (req, res) => {
    try {
        const now = new Date();
        const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        const subs = await Subscription.find({
            status: 'active',
            expiresAt: { $gte: now, $lte: in7Days }
        }).populate('companyId', 'name email').lean();

        return res.json({ success: true, atRisk: subs });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
//  PAYMENTS — histórico por empresa
// ═════════════════════════════════════════════════════════════════════════════

exports.getCompanyPayments = async (req, res) => {
    try {
        const { id } = req.params;
        const payments = await Payment.find({ companyId: id }).sort({ date: -1 }).lean();
        const total = payments.reduce((acc, p) => acc + (p.amount || 0), 0);
        return res.json({ success: true, payments, total });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
//  LOGIN AUDIT
// ═════════════════════════════════════════════════════════════════════════════

exports.getLoginAudit = async (req, res) => {
    try {
        const { userId, email, success, limit = 100 } = req.query;
        const filter = {};
        if (userId) filter.userId = userId;
        if (email) filter.email = { $regex: email, $options: 'i' };
        if (success !== undefined) filter.success = success === 'true';

        const logs = await LoginAudit.find(filter)
            .sort({ createdAt: -1 })
            .limit(Math.min(Number(limit), 500))
            .populate('userId', 'name email')
            .populate('companyId', 'name')
            .lean();
        return res.json({ success: true, logs });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
//  SYSTEM SETTINGS — banner global, maintenance mode
// ═════════════════════════════════════════════════════════════════════════════

exports.getSystemSettings = async (req, res) => {
    try {
        const settings = await SystemSetting.getSingleton();
        return res.json({ success: true, settings });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

exports.updateBanner = async (req, res) => {
    try {
        const { enabled, message, type, startsAt, endsAt } = req.body;
        const settings = await SystemSetting.getSingleton();
        if (enabled !== undefined) settings.banner.enabled = Boolean(enabled);
        if (message !== undefined) settings.banner.message = String(message);
        if (type !== undefined) settings.banner.type = type;
        if (startsAt !== undefined) settings.banner.startsAt = startsAt ? new Date(startsAt) : null;
        if (endsAt !== undefined) settings.banner.endsAt = endsAt ? new Date(endsAt) : null;
        await settings.save();
        return res.json({ success: true, message: 'Banner actualizado.', banner: settings.banner });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

exports.setMaintenanceMode = async (req, res) => {
    try {
        const { enabled, message } = req.body;
        const settings = await SystemSetting.getSingleton();
        if (enabled !== undefined) settings.maintenanceMode = Boolean(enabled);
        if (message !== undefined) settings.maintenanceMessage = String(message);
        await settings.save();
        return res.json({
            success: true,
            message: settings.maintenanceMode ? 'Modo manutenção ACTIVO.' : 'Modo manutenção DESACTIVADO.',
            settings
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

// Endpoint público (sem auth) para o frontend ler banner
exports.getPublicBanner = async (req, res) => {
    try {
        const settings = await SystemSetting.getSingleton();
        const b = settings.banner;
        const now = new Date();
        const active = b.enabled &&
            (!b.startsAt || b.startsAt <= now) &&
            (!b.endsAt || b.endsAt >= now);
        return res.json({ success: true, banner: active ? b : null });
    } catch (err) {
        return res.json({ success: true, banner: null });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
//  DB HEALTH + BACKUP
// ═════════════════════════════════════════════════════════════════════════════

exports.getDbHealth = async (req, res) => {
    try {
        const db = mongoose.connection.db;
        const stats = await db.stats();
        const collections = await db.listCollections().toArray();
        const counts = {};
        for (const c of collections) {
            counts[c.name] = await db.collection(c.name).countDocuments();
        }
        return res.json({
            success: true,
            db: {
                name: db.databaseName,
                collections: collections.length,
                dataSize: stats.dataSize,
                storageSize: stats.storageSize,
                indexSize: stats.indexSize,
                counts,
            }
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

exports.manualBackup = async (req, res) => {
    try {
        const db = mongoose.connection.db;
        const collections = await db.listCollections().toArray();
        const backup = { createdAt: new Date().toISOString(), collections: {} };
        for (const c of collections) {
            backup.collections[c.name] = await db.collection(c.name).find({}).toArray();
        }
        const filename = `backup-${Date.now()}.json`;
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        return res.send(JSON.stringify(backup));
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
//  EMAIL — broadcast, single, templates
// ═════════════════════════════════════════════════════════════════════════════

exports.emailBroadcast = async (req, res) => {
    try {
        const { subject, html, audience } = req.body; // audience: 'all' | 'active' | 'expired' | 'free' | 'paid'
        if (!subject || !html) return res.status(400).json({ success: false, message: 'subject e html obrigatórios.' });

        let filter = { role: { $ne: 'SUPERADMIN' }, status: 'active' };
        let companyFilter = null;

        if (audience === 'active') companyFilter = { status: 'active' };
        else if (audience === 'expired') companyFilter = { status: { $in: ['expired', 'cancelled'] } };
        else if (audience === 'free') companyFilter = { plan: 'FREE' };
        else if (audience === 'paid') companyFilter = { plan: { $in: ['BASIC', 'PREMIUM'] } };

        if (companyFilter) {
            const subs = await Subscription.find(companyFilter).select('companyId').lean();
            filter.companyId = { $in: subs.map(s => s.companyId) };
        }

        const users = await User.find(filter).select('email name').lean();
        let sent = 0, failed = 0;
        for (const u of users) {
            try {
                await sendGeneric(u.email, subject, html.replace(/\{\{name\}\}/g, u.name || ''));
                sent++;
            } catch (e) { failed++; }
        }
        return res.json({ success: true, message: `Broadcast enviado.`, sent, failed, total: users.length });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

exports.emailCompany = async (req, res) => {
    try {
        const { id } = req.params;
        const { subject, html } = req.body;
        if (!subject || !html) return res.status(400).json({ success: false, message: 'subject e html obrigatórios.' });

        // Tenta primeiro um ADMIN; se não houver, qualquer utilizador da empresa
        let recipient = await User.findOne({ companyId: id, role: 'ADMIN', status: 'active' });
        if (!recipient) recipient = await User.findOne({ companyId: id, status: 'active' });
        if (!recipient) return res.status(404).json({ success: false, message: 'Nenhum utilizador activo encontrado para esta empresa.' });

        await sendGeneric(recipient.email, subject, html.replace(/\{\{name\}\}/g, recipient.name));
        return res.json({ success: true, message: `Email enviado para ${recipient.email}.` });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

exports.listEmailTemplates = async (req, res) => {
    try {
        const templates = await EmailTemplate.find().sort({ key: 1 });
        return res.json({ success: true, templates });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

exports.upsertEmailTemplate = async (req, res) => {
    try {
        const { key } = req.params;
        const { subject, html, description } = req.body;
        if (!subject || !html) return res.status(400).json({ success: false, message: 'subject e html obrigatórios.' });
        const tpl = await EmailTemplate.findOneAndUpdate(
            { key },
            { $set: { key, subject, html, description } },
            { new: true, upsert: true }
        );
        return res.json({ success: true, template: tpl });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
//  ERROR LOGS
// ═════════════════════════════════════════════════════════════════════════════

exports.getErrorLogs = async (req, res) => {
    try {
        const { limit = 100 } = req.query;
        const logs = await ErrorLog.find()
            .sort({ createdAt: -1 })
            .limit(Math.min(Number(limit), 500))
            .lean();
        return res.json({ success: true, logs });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
//  RELEASES — Whats-new (acessível a todos para leitura, escrita só SUPERADMIN)
// ═════════════════════════════════════════════════════════════════════════════

exports.listReleases = async (req, res) => {
    try {
        const releases = await Release.find().sort({ pinned: -1, publishedAt: -1 }).limit(100).lean();
        return res.json({ success: true, releases });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

// Conta releases publicados depois do último que o utilizador leu
exports.getUnreadReleasesCount = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('lastReadReleasesAt').lean();
        const cutoff = user?.lastReadReleasesAt || new Date(0);
        const count = await Release.countDocuments({ publishedAt: { $gt: cutoff } });
        const latest = await Release.findOne().sort({ publishedAt: -1 }).select('publishedAt').lean();
        return res.json({ success: true, count, latestPublishedAt: latest?.publishedAt || null });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

// Marca como lido: actualiza lastReadReleasesAt para now
exports.markReleasesRead = async (req, res) => {
    try {
        await User.findByIdAndUpdate(req.user.id, { $set: { lastReadReleasesAt: new Date() } });
        return res.json({ success: true });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

exports.createRelease = async (req, res) => {
    try {
        const { title, version, body, type, pinned } = req.body;
        if (!title || !body) return res.status(400).json({ success: false, message: 'Título e conteúdo obrigatórios.' });
        const r = await Release.create({
            title, version: version || '', body, type: type || 'feature',
            pinned: !!pinned, authorName: req.user.name || 'SUPERADMIN',
        });
        return res.json({ success: true, release: r });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

exports.updateRelease = async (req, res) => {
    try {
        const { id } = req.params;
        const allowed = ['title', 'version', 'body', 'type', 'pinned'];
        const update = {};
        for (const f of allowed) if (req.body[f] !== undefined) update[f] = req.body[f];
        const r = await Release.findByIdAndUpdate(id, { $set: update }, { new: true });
        if (!r) return res.status(404).json({ success: false, message: 'Não encontrado.' });
        return res.json({ success: true, release: r });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

exports.deleteRelease = async (req, res) => {
    try {
        await Release.findByIdAndDelete(req.params.id);
        return res.json({ success: true, message: 'Release apagado.' });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

exports.clearErrorLogs = async (req, res) => {
    try {
        await ErrorLog.deleteMany({});
        return res.json({ success: true, message: 'Logs de erro apagados.' });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};
