const PLANS = {
    FREE: {
        name: 'FREE',
        label: 'Gratuito',
        maxInvoicesPerMonth: 5,
        maxSalesPerMonth: 10,
        maxClients: 10,
        maxProducts: 15,
        maxUsers: 1,
        excelExport: false,
        advancedReports: false,
        trialDays: 30,
        priceLabel: 'Grátis (30 dias)',
        priceMZN: 0,
    },
    BASIC: {
        name: 'BASIC',
        label: 'Básico',
        maxInvoicesPerMonth: 50,
        maxSalesPerMonth: 150,
        maxClients: 100,
        maxProducts: 200,
        maxUsers: 3,
        excelExport: true,
        advancedReports: false,
        priceLabel: '799 MZN/mês',
        priceMZN: 799,
    },
    PREMIUM: {
        name: 'PREMIUM',
        label: 'Premium',
        maxInvoicesPerMonth: Infinity,
        maxSalesPerMonth: Infinity,
        maxClients: Infinity,
        maxProducts: Infinity,
        maxUsers: Infinity,
        excelExport: true,
        advancedReports: true,
        priceLabel: '1.299 MZN/mês',
        priceMZN: 1299,
    }
};

const getPlan = (planName) => PLANS[planName] || PLANS.FREE;

const getFreePlanExpiration = () => {
    const date = new Date();
    date.setDate(date.getDate() + 30);
    return date;
};

const getPaidPlanExpiration = () => {
    const date = new Date();
    date.setDate(date.getDate() + 30);
    return date;
};

module.exports = { PLANS, getPlan, getFreePlanExpiration, getPaidPlanExpiration };