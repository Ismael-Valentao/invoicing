const PlanConfig = require('../models/planConfig');

// Defaults hardcoded (usados como fallback se a DB não tiver configs)
const DEFAULTS = {
    FREE: {
        name: 'FREE', label: 'Gratuito',
        maxInvoicesPerMonth: 5, maxSalesPerMonth: 10,
        maxClients: 10, maxProducts: 15, maxUsers: 1,
        excelExport: false, advancedReports: false,
        trialDays: 30, priceLabel: 'Grátis (30 dias)', priceMZN: 0,
    },
    BASIC: {
        name: 'BASIC', label: 'Básico',
        maxInvoicesPerMonth: 50, maxSalesPerMonth: 150,
        maxClients: 100, maxProducts: 200, maxUsers: 3,
        excelExport: true, advancedReports: false,
        trialDays: 0,
        priceLabel: '799 MZN/mês', priceMZN: 799,
        priceAnnualLabel: '4.794 MZN/ano (50% de desconto)', priceAnnualMZN: 4794,
    },
    PREMIUM: {
        name: 'PREMIUM', label: 'Premium',
        maxInvoicesPerMonth: 999999, maxSalesPerMonth: 999999,
        maxClients: 999999, maxProducts: 999999, maxUsers: 999999,
        excelExport: true, advancedReports: true,
        trialDays: 0,
        priceLabel: '1.299 MZN/mês', priceMZN: 1299,
        priceAnnualLabel: '7.794 MZN/ano (50% de desconto)', priceAnnualMZN: 7794,
    }
};

// Cache in memory (refreshed every 5 min or on demand)
let _cache = null;
let _cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000;

function toPlainPlan(doc) {
    const obj = doc.toObject ? doc.toObject() : { ...doc };
    // Treat 999999+ as Infinity for internal checks
    for (const k of ['maxInvoicesPerMonth', 'maxSalesPerMonth', 'maxClients', 'maxProducts', 'maxUsers']) {
        if (obj[k] >= 999999) obj[k] = Infinity;
    }
    return obj;
}

async function loadPlans() {
    if (_cache && Date.now() - _cacheTime < CACHE_TTL) return _cache;
    try {
        const docs = await PlanConfig.find({});
        const plans = { ...DEFAULTS };
        for (const doc of docs) {
            plans[doc.name] = toPlainPlan(doc);
        }
        _cache = plans;
        _cacheTime = Date.now();
        return plans;
    } catch (e) {
        return DEFAULTS;
    }
}

function invalidateCache() {
    _cache = null;
    _cacheTime = 0;
}

// Synchronous access — returns cached or defaults
// For places that can't await (e.g. middleware that already loaded)
const PLANS = new Proxy(DEFAULTS, {
    get(target, prop) {
        if (_cache && _cache[prop]) return _cache[prop];
        return target[prop];
    }
});

const getPlan = (planName) => {
    if (_cache && _cache[planName]) return _cache[planName];
    return DEFAULTS[planName] || DEFAULTS.FREE;
};

const getFreePlanExpiration = () => {
    const plan = getPlan('FREE');
    const date = new Date();
    date.setDate(date.getDate() + (plan.trialDays || 30));
    return date;
};

const getPaidPlanExpiration = (billingCycle = 'monthly') => {
    const date = new Date();
    date.setDate(date.getDate() + (billingCycle === 'annual' ? 365 : 30));
    return date;
};

module.exports = { PLANS, DEFAULTS, getPlan, getFreePlanExpiration, getPaidPlanExpiration, loadPlans, invalidateCache };
