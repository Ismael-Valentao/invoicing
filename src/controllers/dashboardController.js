const mongoose = require('mongoose');
const Product = require('../models/product');
const Invoice = require('../models/invoice');
const Sale = require('../models/sale');
const Client = require('../models/client');
const Expense = require('../models/expense');

function toObjectId(id) {
    return new mongoose.Types.ObjectId(id);
}

// Low-stock products
exports.getLowStock = async (req, res) => {
    try {
        const products = await Product.find({
            companyId: req.user.company._id,
            active: true,
            'stock.min': { $gt: 0 },
            $expr: { $lte: ['$stock.quantity', '$stock.min'] }
        }).sort({ 'stock.quantity': 1 }).limit(10);
        res.json({ success: true, products });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// Client debts (unpaid/overdue invoices grouped by client)
exports.getClientDebts = async (req, res) => {
    try {
        const companyId = toObjectId(req.user.company._id);
        const debts = await Invoice.aggregate([
            {
                $match: {
                    companyId,
                    docType: 'invoice',
                    status: { $in: ['unpaid', 'overdue'] }
                }
            },
            {
                $group: {
                    _id: '$clientName',
                    clientId: { $first: '$clientId' },
                    totalDebt: { $sum: '$totalAmount' },
                    invoiceCount: { $sum: 1 },
                    oldestDueDate: { $min: '$dueDate' },
                    invoices: {
                        $push: {
                            _id: '$_id',
                            invoiceNumber: '$invoiceNumber',
                            totalAmount: '$totalAmount',
                            dueDate: '$dueDate',
                            status: '$status',
                            date: '$date'
                        }
                    }
                }
            },
            { $sort: { totalDebt: -1 } },
            { $limit: 20 }
        ]);
        const totalDebt = debts.reduce((sum, d) => sum + d.totalDebt, 0);
        res.json({ success: true, debts, totalDebt });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// "Quanto poupaste" - value/savings estimate
exports.getSavingsStats = async (req, res) => {
    try {
        const companyId = req.user.company._id;
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const [invoiceCount, saleCount, clientCount, productCount] = await Promise.all([
            Invoice.countDocuments({ companyId, docType: 'invoice', createdAt: { $gte: startOfMonth } }),
            Sale.countDocuments({ companyId, status: 'confirmed', createdAt: { $gte: startOfMonth } }),
            Client.countDocuments({ companyId }),
            Product.countDocuments({ companyId, active: true })
        ]);

        // Estimates: ~5 min per manual invoice, ~3 min per manual sale, ~2 min per client lookup
        const minutesSaved = (invoiceCount * 5) + (saleCount * 3) + (clientCount * 0.5);
        const hoursSaved = Math.round(minutesSaved / 60 * 10) / 10;

        res.json({
            success: true,
            stats: {
                invoicesThisMonth: invoiceCount,
                salesThisMonth: saleCount,
                totalClients: clientCount,
                totalProducts: productCount,
                minutesSaved: Math.round(minutesSaved),
                hoursSaved,
                documentsThisMonth: invoiceCount + saleCount
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// Dashboard insights (smart text messages)
exports.getInsights = async (req, res) => {
    try {
        const companyId = toObjectId(req.user.company._id);
        const companyIdRaw = req.user.company._id;
        const now = new Date();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - 7);
        const startOfPrevWeek = new Date(now);
        startOfPrevWeek.setDate(now.getDate() - 14);

        const [thisWeekSales, prevWeekSales, topProduct, lowStockCount, overdueCount, expensesThisMonth] = await Promise.all([
            Sale.aggregate([
                { $match: { companyId, status: 'confirmed', createdAt: { $gte: startOfWeek } } },
                { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } }
            ]),
            Sale.aggregate([
                { $match: { companyId, status: 'confirmed', createdAt: { $gte: startOfPrevWeek, $lt: startOfWeek } } },
                { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } }
            ]),
            Sale.aggregate([
                { $match: { companyId, status: 'confirmed', createdAt: { $gte: startOfWeek } } },
                { $unwind: '$items' },
                { $group: { _id: '$items.name', totalQty: { $sum: '$items.quantity' } } },
                { $sort: { totalQty: -1 } },
                { $limit: 1 }
            ]),
            Product.countDocuments({
                companyId: companyIdRaw, active: true, 'stock.min': { $gt: 0 },
                $expr: { $lte: ['$stock.quantity', '$stock.min'] }
            }),
            Invoice.countDocuments({
                companyId: companyIdRaw, docType: 'invoice', status: 'unpaid',
                dueDate: { $lt: now }
            }),
            Expense.aggregate([
                { $match: { companyId, date: { $gte: new Date(now.getFullYear(), now.getMonth(), 1) } } },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ])
        ]);

        const insights = [];
        const twSales = thisWeekSales[0] || { total: 0, count: 0 };
        const pwSales = prevWeekSales[0] || { total: 0, count: 0 };

        // Sales comparison
        if (pwSales.total > 0 && twSales.total > 0) {
            const pct = Math.round(((twSales.total - pwSales.total) / pwSales.total) * 100);
            if (pct > 0) {
                insights.push({ icon: 'fas fa-arrow-up', color: 'success', text: `As tuas vendas subiram ${pct}% esta semana em relação à semana passada.` });
            } else if (pct < -5) {
                insights.push({ icon: 'fas fa-arrow-down', color: 'warning', text: `As tuas vendas desceram ${Math.abs(pct)}% esta semana. Considera promoções ou campanhas.` });
            }
        }

        // Top product
        if (topProduct[0]) {
            insights.push({ icon: 'fas fa-trophy', color: 'primary', text: `O teu produto mais vendido esta semana é "${topProduct[0]._id}" com ${topProduct[0].totalQty} unidades.` });
        }

        // Low stock alert
        if (lowStockCount > 0) {
            insights.push({ icon: 'fas fa-exclamation-triangle', color: 'warning', text: `Tens ${lowStockCount} produto${lowStockCount > 1 ? 's' : ''} com stock baixo. Verifica e reabastece.` });
        }

        // Overdue invoices
        if (overdueCount > 0) {
            insights.push({ icon: 'fas fa-file-invoice', color: 'danger', text: `Tens ${overdueCount} factura${overdueCount > 1 ? 's' : ''} vencida${overdueCount > 1 ? 's' : ''}. Contacta os clientes devedores.` });
        }

        // Expenses
        const expTotal = expensesThisMonth[0]?.total || 0;
        if (expTotal > 0) {
            const currency = new Intl.NumberFormat('pt-MZ', { style: 'currency', currency: 'MZN' }).format(expTotal);
            insights.push({ icon: 'fas fa-wallet', color: 'info', text: `Total de despesas este mês: ${currency}.` });
        }

        // Sales count
        if (twSales.count > 0) {
            insights.push({ icon: 'fas fa-cart-plus', color: 'success', text: `Registaste ${twSales.count} venda${twSales.count > 1 ? 's' : ''} esta semana.` });
        }

        res.json({ success: true, insights });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// Saudação contextual ao chegar ao dashboard
exports.getGreeting = async (req, res) => {
    try {
        const companyId = toObjectId(req.user.company._id);
        const companyIdRaw = req.user.company._id;
        const fullName = req.user.name || '';
        const firstName = fullName.trim().split(/\s+/)[0] || 'Olá';

        const now = new Date();
        const hour = now.getHours();
        let period;
        if (hour < 12) period = 'Bom dia';
        else if (hour < 18) period = 'Boa tarde';
        else period = 'Boa noite';

        // Janela de "ontem"
        const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startYesterday = new Date(startToday); startYesterday.setDate(startToday.getDate() - 1);

        const [overdueCount, lowStockCount, ySales, yInvoices, lastSale] = await Promise.all([
            Invoice.countDocuments({
                companyId: companyIdRaw, docType: 'invoice', status: 'unpaid',
                dueDate: { $lt: now }
            }),
            Product.countDocuments({
                companyId: companyIdRaw, active: true, 'stock.min': { $gt: 0 },
                $expr: { $lte: ['$stock.quantity', '$stock.min'] }
            }),
            Sale.aggregate([
                { $match: { companyId, status: 'confirmed', createdAt: { $gte: startYesterday, $lt: startToday } } },
                { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } }
            ]),
            Invoice.aggregate([
                { $match: { companyId, docType: 'invoice', createdAt: { $gte: startYesterday, $lt: startToday } } },
                { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } }
            ]),
            Sale.findOne({ companyId, status: 'confirmed' }).sort({ createdAt: -1 }).select('createdAt').lean()
        ]);

        const fmtMZN = (v) => new Intl.NumberFormat('pt-MZ', { style: 'currency', currency: 'MZN', maximumFractionDigits: 0 }).format(v);
        const dayName = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'][now.getDay()];
        const monthName = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'][now.getMonth()];
        const dateLabel = `${dayName}, ${now.getDate()} de ${monthName}`;

        // Escolhe a mensagem mais relevante (prioridade: alertas → bons resultados → genérico)
        const yesterdayTotal = (ySales[0]?.total || 0) + (yInvoices[0]?.total || 0);
        const yesterdayCount = (ySales[0]?.count || 0) + (yInvoices[0]?.count || 0);

        let message;
        let icon = 'fa-hand-sparkles';
        let tone = 'primary';

        if (overdueCount > 0) {
            message = `Tens ${overdueCount} factura${overdueCount > 1 ? 's' : ''} vencida${overdueCount > 1 ? 's' : ''} a precisar${overdueCount > 1 ? 'em' : ''} de atenção.`;
            icon = 'fa-file-invoice-dollar';
            tone = 'danger';
        } else if (lowStockCount > 0) {
            message = `${lowStockCount} produto${lowStockCount > 1 ? 's estão' : ' está'} com stock abaixo do mínimo.`;
            icon = 'fa-boxes';
            tone = 'warning';
        } else if (yesterdayTotal > 0) {
            message = `Ontem facturaste ${fmtMZN(yesterdayTotal)} em ${yesterdayCount} documento${yesterdayCount > 1 ? 's' : ''}. Bom trabalho!`;
            icon = 'fa-trophy';
            tone = 'success';
        } else if (lastSale && (now - new Date(lastSale.createdAt)) > 1000 * 60 * 60 * 24 * 5) {
            message = 'Que bom ver-te de volta! Pronto para retomar o ritmo?';
            icon = 'fa-hand-sparkles';
            tone = 'info';
        } else {
            // Mensagens genéricas variadas por dia da semana
            const genericByDay = {
                0: 'Espero que estejas a ter um bom domingo.',
                1: 'Mais uma semana a começar — vamos a isto!',
                2: 'Bom dia de produtividade pela frente.',
                3: 'A meio da semana — continua o bom trabalho!',
                4: 'Quase lá, o fim-de-semana aproxima-se.',
                5: 'Sexta-feira! Bom fim-de-semana à vista.',
                6: 'Bom sábado de trabalho!'
            };
            message = genericByDay[now.getDay()];
            icon = 'fa-sun';
            tone = 'primary';
        }

        return res.json({
            success: true,
            greeting: {
                title: `${period}, ${firstName}!`,
                date: dateLabel,
                message,
                icon,
                tone
            }
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

// Profit overview (revenue - expenses)
exports.getProfitOverview = async (req, res) => {
    try {
        const companyId = toObjectId(req.user.company._id);
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const [salesRevenue, invoiceRevenue, expenses] = await Promise.all([
            Sale.aggregate([
                { $match: { companyId, status: 'confirmed', createdAt: { $gte: startOfMonth } } },
                { $group: { _id: null, total: { $sum: '$total' } } }
            ]),
            Invoice.aggregate([
                { $match: { companyId, docType: 'invoice', status: 'paid', createdAt: { $gte: startOfMonth } } },
                { $group: { _id: null, total: { $sum: '$totalAmount' } } }
            ]),
            Expense.aggregate([
                { $match: { companyId, date: { $gte: startOfMonth } } },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ])
        ]);

        const revenue = (salesRevenue[0]?.total || 0) + (invoiceRevenue[0]?.total || 0);
        const totalExpenses = expenses[0]?.total || 0;
        const profit = revenue - totalExpenses;

        res.json({
            success: true,
            overview: { revenue, expenses: totalExpenses, profit }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};