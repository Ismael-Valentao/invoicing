/**
 * Cron jobs da plataforma Invoicing.
 * Executados via setInterval ao arrancar o servidor.
 */
const Subscription = require('../models/subscription');
const Company = require('../models/company');
const User = require('../models/user');
const Invoice = require('../models/invoice');
const Sale = require('../models/sale');
const Client = require('../models/client');
const RecurringInvoice = require('../models/recurringInvoice');
const { getNextInvoiceNumber } = require('./numerationGenerator');
const { generateNotifications } = require('../controllers/notificationController');
const { getPlan } = require('./plans');
const {
    sendExpiryWarningEmail,
    sendLimitWarningEmail,
    sendMonthlySummaryEmail,
} = require('./mailSender');

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function startOfMonth() {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
}

/**
 * Marca subscrições expiradas e envia avisos de 7 dias.
 */
async function runExpiryCheck() {
    try {
        const now = new Date();
        const in7Days = new Date(now.getTime() + 7 * MS_PER_DAY);

        // 1. Expirar subscrições vencidas
        const expired = await Subscription.updateMany(
            { status: 'active', expiresAt: { $lt: now } },
            { $set: { status: 'expired' } }
        );
        if (expired.modifiedCount > 0) {
            console.log(`[Cron] ${expired.modifiedCount} subscrição(ões) marcada(s) como expirada(s).`);
        }

        // 2. Avisos de expiração em 7 dias
        const expiringSoon = await Subscription.find({
            status: 'active',
            expiresAt: { $gte: now, $lte: in7Days }
        }).populate('companyId');

        for (const sub of expiringSoon) {
            const company = sub.companyId;
            if (!company) continue;

            const adminUser = await User.findOne({ companyId: company._id, role: 'ADMIN' });
            if (!adminUser) continue;

            const daysLeft = Math.ceil((sub.expiresAt - now) / MS_PER_DAY);
            const plan = getPlan(sub.plan);

            await sendExpiryWarningEmail(
                adminUser.email,
                adminUser.name,
                company.name,
                daysLeft,
                plan.label
            );
        }

        console.log(`[Cron] Expiração verificada. ${expiringSoon.length} aviso(s) enviado(s).`);
    } catch (err) {
        console.error('[Cron] Erro no expiryCheck:', err.message);
    }
}

/**
 * Verifica limites próximos de 80% e envia avisos.
 */
async function runLimitCheck() {
    try {
        const activeSubs = await Subscription.find({ status: 'active' }).populate('companyId');

        for (const sub of activeSubs) {
            const company = sub.companyId;
            if (!company) continue;

            const plan = getPlan(sub.plan);
            const adminUser = await User.findOne({ companyId: company._id, role: 'ADMIN' });
            if (!adminUser) continue;

            const companyId = company._id;
            const checks = [];

            if (plan.maxInvoicesPerMonth !== Infinity) {
                const count = await Invoice.countDocuments({ companyId, createdAt: { $gte: startOfMonth() } });
                checks.push({ resource: 'invoices', count, max: plan.maxInvoicesPerMonth });
            }
            if (plan.maxSalesPerMonth !== Infinity) {
                const count = await Sale.countDocuments({ companyId, createdAt: { $gte: startOfMonth() } });
                checks.push({ resource: 'sales', count, max: plan.maxSalesPerMonth });
            }
            if (plan.maxClients !== Infinity) {
                const count = await Client.countDocuments({ companyId });
                checks.push({ resource: 'clients', count, max: plan.maxClients });
            }

            for (const { resource, count, max } of checks) {
                const pct = count / max;
                // Avisa uma vez quando passa os 80%
                if (pct >= 0.8 && pct < 1) {
                    await sendLimitWarningEmail(
                        adminUser.email,
                        adminUser.name,
                        company.name,
                        resource,
                        count,
                        max,
                        plan.label
                    );
                }
            }
        }

        console.log('[Cron] Verificação de limites concluída.');
    } catch (err) {
        console.error('[Cron] Erro no limitCheck:', err.message);
    }
}

/**
 * Envia resumo mensal no 1º dia de cada mês.
 */
async function runMonthlySummary() {
    const now = new Date();
    if (now.getDate() !== 1) return; // Só executa no 1º dia do mês

    try {
        const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 1);

        const activeSubs = await Subscription.find({ status: 'active' }).populate('companyId');

        for (const sub of activeSubs) {
            const company = sub.companyId;
            if (!company) continue;

            const adminUser = await User.findOne({ companyId: company._id, role: 'ADMIN' });
            if (!adminUser) continue;

            const companyId = company._id;
            const dateFilter = { createdAt: { $gte: prevMonthStart, $lt: prevMonthEnd } };

            const [invoices, sales, newClients, invoiceAgg, salesAgg] = await Promise.all([
                Invoice.countDocuments({ companyId, ...dateFilter }),
                Sale.countDocuments({ companyId, status: 'confirmed', ...dateFilter }),
                Client.countDocuments({ companyId, ...dateFilter }),
                Invoice.aggregate([
                    { $match: { companyId: company._id, ...dateFilter } },
                    { $group: { _id: null, total: { $sum: '$totalAmount' } } }
                ]),
                Sale.aggregate([
                    { $match: { companyId: company._id, status: 'confirmed', ...dateFilter } },
                    { $group: { _id: null, total: { $sum: '$total' } } }
                ]),
            ]);

            await sendMonthlySummaryEmail(adminUser.email, adminUser.name, company.name, {
                invoices,
                sales,
                newClients,
                totalInvoiced: invoiceAgg[0]?.total || 0,
                totalSales: salesAgg[0]?.total || 0,
            });
        }

        console.log('[Cron] Resumos mensais enviados.');
    } catch (err) {
        console.error('[Cron] Erro no monthlySummary:', err.message);
    }
}

/**
 * Gera notificações in-app (stock baixo, facturas vencidas) para todas as empresas.
 */
async function runNotificationGeneration() {
    try {
        const companies = await Company.find({}, '_id');
        for (const c of companies) {
            await generateNotifications(c._id);
        }
        console.log(`[Cron] Notificações geradas para ${companies.length} empresa(s).`);
    } catch (err) {
        console.error('[Cron] Erro na geração de notificações:', err.message);
    }
}

/**
 * Processa facturas recorrentes que atingiram a nextRunDate.
 */
async function runRecurringInvoices() {
    try {
        const now = new Date();
        const due = await RecurringInvoice.find({ active: true, nextRunDate: { $lte: now } });

        for (const ri of due) {
            // Generate next invoice number
            const invoiceNumber = await getNextInvoiceNumber(ri.companyId);

            const company = await Company.findById(ri.companyId);
            if (!company) continue;

            await Invoice.create({
                docType: 'invoice',
                companyId: ri.companyId,
                userId: ri.userId,
                clientId: ri.clientId,
                companyName: company.name,
                clientName: ri.clientName,
                clientNUIT: ri.clientNUIT || 'N/A',
                invoiceNumber,
                items: ri.items,
                appliedTax: ri.appliedTax,
                subTotal: ri.subTotal,
                tax: ri.tax,
                totalAmount: ri.totalAmount,
                showBankDetails: ri.showBankDetails,
                showNotes: ri.showNotes,
                status: 'unpaid',
                date: now,
                dueDate: new Date(now.getTime() + 30 * MS_PER_DAY),
            });

            // Calculate next run date
            const intervals = { weekly: 7, monthly: 30, quarterly: 90, yearly: 365 };
            const daysToAdd = intervals[ri.interval] || 30;
            ri.lastRunDate = now;
            ri.nextRunDate = new Date(now.getTime() + daysToAdd * MS_PER_DAY);
            ri.generatedCount += 1;
            await ri.save();
        }

        if (due.length > 0) console.log(`[Cron] ${due.length} factura(s) recorrente(s) gerada(s).`);
    } catch (err) {
        console.error('[Cron] Erro nas facturas recorrentes:', err.message);
    }
}

/**
 * Inicializa todos os jobs.
 * - Expiração: a cada 12 horas
 * - Limites: a cada 6 horas
 * - Resumo mensal: a cada 24 horas (verifica internamente se é dia 1)
 * - Notificações: a cada 4 horas
 * - Facturas recorrentes: a cada 6 horas
 */
function startCronJobs() {
    // Executa imediatamente ao arrancar e depois em intervalos
    runExpiryCheck();
    runLimitCheck();
    runMonthlySummary();
    runNotificationGeneration();
    runRecurringInvoices();

    setInterval(runExpiryCheck, 12 * 60 * 60 * 1000);  // 12h
    setInterval(runLimitCheck, 6 * 60 * 60 * 1000);    // 6h
    setInterval(runMonthlySummary, 24 * 60 * 60 * 1000); // 24h
    setInterval(runNotificationGeneration, 4 * 60 * 60 * 1000); // 4h
    setInterval(runRecurringInvoices, 6 * 60 * 60 * 1000); // 6h

    console.log('[Cron] Jobs iniciados.');
}

module.exports = { startCronJobs };
