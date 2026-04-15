const Subscription = require('../models/subscription');
const Invoice = require('../models/invoice');
const Sale = require('../models/sale');
const Product = require('../models/product');
const Client = require('../models/client');
const User = require('../models/user');
const { getPlan } = require('../utils/plans');
const { applyPendingRewards } = require('../utils/applyPendingRewards');

/**
 * Verifica se a subscrição da empresa está activa.
 * Se expirada, bloqueia todas as acções de criação.
 */
/**
 * Versão para páginas (GET /new-invoice, /new-sale, etc.).
 * Em vez de JSON 403, redirecciona para /upgrade com flash na query.
 */
async function requireActiveSubscription(req, res, next) {
    try {
        if (req.user?.role === 'SUPERADMIN') return next();
        const companyId = req.user?.company?._id;
        if (!companyId) return next();

        const sub = await Subscription.findOne({ companyId });
        if (sub) await applyPendingRewards(sub);

        if (!sub || sub.status !== 'active' || (sub.expiresAt && sub.expiresAt < new Date())) {
            if (sub && sub.status === 'active' && sub.expiresAt && sub.expiresAt < new Date()) {
                sub.status = 'expired';
                await sub.save();
            }
            return res.redirect('/upgrade?expired=1');
        }
        next();
    } catch (err) {
        next(err);
    }
}

async function checkSubscriptionActive(req, res, next) {
    try {
        const companyId = req.user.company._id;
        const sub = await Subscription.findOne({ companyId });
        if (sub) await applyPendingRewards(sub);

        if (!sub || sub.status !== 'active') {
            return res.status(403).json({
                success: false,
                planBlocked: true,
                message: 'A tua subscrição expirou. Renova o plano para continuar.',
                upgradeUrl: '/upgrade'
            });
        }

        // Verifica expiração em tempo real (cron pode ter falhado)
        if (sub.expiresAt < new Date()) {
            sub.status = 'expired';
            await sub.save();
            return res.status(403).json({
                success: false,
                planBlocked: true,
                message: 'A tua subscrição expirou. Renova o plano para continuar.',
                upgradeUrl: '/upgrade'
            });
        }

        req.subscription = sub;
        next();
    } catch (err) {
        next(err);
    }
}

function startOfMonth() {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
}

/**
 * Verifica limite mensal de facturas.
 */
async function checkInvoiceLimit(req, res, next) {
    try {
        const companyId = req.user.company._id;
        const sub = req.subscription;
        const plan = getPlan(sub.plan);

        if (plan.maxInvoicesPerMonth === Infinity) return next();

        const count = await Invoice.countDocuments({
            companyId,
            createdAt: { $gte: startOfMonth() }
        });

        if (count >= plan.maxInvoicesPerMonth) {
            return res.status(403).json({
                success: false,
                limitReached: true,
                resource: 'invoices',
                current: count,
                max: plan.maxInvoicesPerMonth,
                message: `Atingiste o limite de ${plan.maxInvoicesPerMonth} factura(s) por mês no plano ${plan.label}. Faz upgrade para continuar.`,
                upgradeUrl: '/upgrade'
            });
        }

        next();
    } catch (err) {
        next(err);
    }
}

/**
 * Verifica limite mensal de vendas.
 */
async function checkSaleLimit(req, res, next) {
    try {
        const companyId = req.user.company._id;
        const sub = req.subscription;
        const plan = getPlan(sub.plan);

        if (plan.maxSalesPerMonth === Infinity) return next();

        const count = await Sale.countDocuments({
            companyId,
            createdAt: { $gte: startOfMonth() }
        });

        if (count >= plan.maxSalesPerMonth) {
            return res.status(403).json({
                success: false,
                limitReached: true,
                resource: 'sales',
                current: count,
                max: plan.maxSalesPerMonth,
                message: `Atingiste o limite de ${plan.maxSalesPerMonth} venda(s) por mês no plano ${plan.label}. Faz upgrade para continuar.`,
                upgradeUrl: '/upgrade'
            });
        }

        next();
    } catch (err) {
        next(err);
    }
}

/**
 * Verifica limite total de clientes.
 */
async function checkClientLimit(req, res, next) {
    try {
        const companyId = req.user.company._id;
        const sub = req.subscription;
        const plan = getPlan(sub.plan);

        if (plan.maxClients === Infinity) return next();

        const count = await Client.countDocuments({ companyId });

        if (count >= plan.maxClients) {
            return res.status(403).json({
                success: false,
                limitReached: true,
                resource: 'clients',
                current: count,
                max: plan.maxClients,
                message: `Atingiste o limite de ${plan.maxClients} cliente(s) no plano ${plan.label}. Faz upgrade para continuar.`,
                upgradeUrl: '/upgrade'
            });
        }

        next();
    } catch (err) {
        next(err);
    }
}

/**
 * Verifica limite total de produtos.
 */
async function checkProductLimit(req, res, next) {
    try {
        const companyId = req.user.company._id;
        const sub = req.subscription;
        const plan = getPlan(sub.plan);

        if (plan.maxProducts === Infinity) return next();

        const count = await Product.countDocuments({ companyId });

        if (count >= plan.maxProducts) {
            return res.status(403).json({
                success: false,
                limitReached: true,
                resource: 'products',
                current: count,
                max: plan.maxProducts,
                message: `Atingiste o limite de ${plan.maxProducts} produto(s) no plano ${plan.label}. Faz upgrade para continuar.`,
                upgradeUrl: '/upgrade'
            });
        }

        next();
    } catch (err) {
        next(err);
    }
}

/**
 * Verifica se o plano permite exportação Excel.
 */
async function checkExcelExportAllowed(req, res, next) {
    try {
        const companyId = req.user.company._id;
        const sub = await Subscription.findOne({ companyId });
        const plan = getPlan(sub?.plan || 'FREE');

        if (!plan.excelExport) {
            return res.status(403).json({
                success: false,
                featureBlocked: true,
                message: `Exportação Excel não está disponível no plano ${plan.label}. Faz upgrade para aceder.`,
                upgradeUrl: '/upgrade'
            });
        }

        next();
    } catch (err) {
        next(err);
    }
}

module.exports = {
    checkSubscriptionActive,
    requireActiveSubscription,
    checkInvoiceLimit,
    checkSaleLimit,
    checkClientLimit,
    checkProductLimit,
    checkExcelExportAllowed
};