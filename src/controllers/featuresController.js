const mongoose = require('mongoose');
const Product = require('../models/product');
const Sale = require('../models/sale');
const Invoice = require('../models/invoice');
const Client = require('../models/client');
const Expense = require('../models/expense');
const SalesGoal = require('../models/salesGoal');
const PriceHistory = require('../models/priceHistory');
const InvoiceTemplate = require('../models/invoiceTemplate');

function toOid(id) { return new mongoose.Types.ObjectId(id); }

// ─── PROFIT PER PRODUCT ──────────────────────────────────────────────────────
exports.getProductProfits = async (req, res) => {
    try {
        const companyId = req.user.company._id;
        const products = await Product.find({ companyId, active: true });

        // Get total sold qty per product from confirmed sales
        const salesAgg = await Sale.aggregate([
            { $match: { companyId: toOid(companyId), status: 'confirmed' } },
            { $unwind: '$items' },
            { $group: { _id: '$items.productId', totalQty: { $sum: '$items.quantity' }, totalRevenue: { $sum: { $multiply: ['$items.quantity', '$items.price'] } } } }
        ]);
        const salesMap = {};
        salesAgg.forEach(s => { salesMap[String(s._id)] = s; });

        const result = products.map(p => {
            const s = salesMap[String(p._id)] || { totalQty: 0, totalRevenue: 0 };
            const cost = (p.costPrice || 0) * s.totalQty;
            const profit = s.totalRevenue - cost;
            const margin = s.totalRevenue > 0 ? Math.round((profit / s.totalRevenue) * 100) : 0;
            return {
                _id: p._id, description: p.description, unitPrice: p.unitPrice,
                costPrice: p.costPrice || 0, soldQty: s.totalQty,
                revenue: s.totalRevenue, cost, profit, margin
            };
        }).sort((a, b) => b.profit - a.profit);

        res.json({ success: true, products: result });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─── SALES GOALS ─────────────────────────────────────────────────────────────
exports.getSalesGoal = async (req, res) => {
    try {
        const companyId = req.user.company._id;
        const now = new Date();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();

        let goal = await SalesGoal.findOne({ companyId, month, year });

        // Current month sales total
        const startOfMonth = new Date(year, month - 1, 1);
        const salesTotal = await Sale.aggregate([
            { $match: { companyId: toOid(companyId), status: 'confirmed', createdAt: { $gte: startOfMonth } } },
            { $group: { _id: null, total: { $sum: '$total' } } }
        ]);
        const current = salesTotal[0]?.total || 0;

        res.json({
            success: true,
            goal: goal ? { targetAmount: goal.targetAmount, month, year } : null,
            current,
            percentage: goal ? Math.min(100, Math.round((current / goal.targetAmount) * 100)) : 0,
            remaining: goal ? Math.max(0, goal.targetAmount - current) : 0,
            daysLeft: new Date(year, month, 0).getDate() - now.getDate()
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.setSalesGoal = async (req, res) => {
    try {
        const { targetAmount, month, year } = req.body;
        if (!targetAmount || targetAmount <= 0) {
            return res.status(400).json({ success: false, message: 'Valor da meta é obrigatório.' });
        }
        const m = month || (new Date().getMonth() + 1);
        const y = year || new Date().getFullYear();

        await SalesGoal.findOneAndUpdate(
            { companyId: req.user.company._id, month: m, year: y },
            { $set: { targetAmount } },
            { upsert: true }
        );
        res.json({ success: true, message: 'Meta definida.' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─── IVA REPORT ──────────────────────────────────────────────────────────────
exports.getIVAReport = async (req, res) => {
    try {
        const companyId = toOid(req.user.company._id);
        const { from, to } = req.query;
        const startDate = from ? new Date(from) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        const endDate = to ? new Date(to) : new Date();

        const [invoicesIVA, expensesTotal] = await Promise.all([
            Invoice.aggregate([
                { $match: { companyId, docType: 'invoice', status: { $ne: 'cancelled' }, date: { $gte: startDate, $lte: endDate } } },
                { $group: { _id: null, totalSubtotal: { $sum: '$subTotal' }, totalTax: { $sum: '$tax' }, totalAmount: { $sum: '$totalAmount' }, count: { $sum: 1 } } }
            ]),
            Expense.aggregate([
                { $match: { companyId, date: { $gte: startDate, $lte: endDate } } },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ])
        ]);

        const ivaCobrado = invoicesIVA[0]?.totalTax || 0;
        // Estimate IVA suportado as 16% of expenses (simplified)
        const totalExpenses = expensesTotal[0]?.total || 0;
        const ivaSuportado = totalExpenses * 0.16;
        const ivaAPagar = Math.max(0, ivaCobrado - ivaSuportado);

        res.json({
            success: true,
            report: {
                period: { from: startDate, to: endDate },
                invoices: { count: invoicesIVA[0]?.count || 0, subtotal: invoicesIVA[0]?.totalSubtotal || 0, iva: ivaCobrado, total: invoicesIVA[0]?.totalAmount || 0 },
                expenses: { total: totalExpenses, ivaEstimado: ivaSuportado },
                ivaCobrado, ivaSuportado,
                ivaAPagar
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─── CLIENT ANALYSIS ─────────────────────────────────────────────────────────
exports.getClientAnalysis = async (req, res) => {
    try {
        const companyId = toOid(req.user.company._id);
        const now = new Date();
        const d30 = new Date(now.getTime() - 30 * 86400000);

        const [topClients, inactiveClients] = await Promise.all([
            // Top buyers last 30 days
            Sale.aggregate([
                { $match: { companyId, status: 'confirmed', createdAt: { $gte: d30 } } },
                { $lookup: { from: 'clients', localField: 'customerId', foreignField: '_id', as: 'client' } },
                { $unwind: { path: '$client', preserveNullAndEmptyArrays: true } },
                { $group: { _id: '$customerId', name: { $first: '$client.name' }, totalSpent: { $sum: '$total' }, purchases: { $sum: 1 } } },
                { $match: { name: { $ne: null } } },
                { $sort: { totalSpent: -1 } },
                { $limit: 10 }
            ]),
            // Clients with no purchases in 30 days
            Client.aggregate([
                { $match: { companyId } },
                { $lookup: { from: 'sales', let: { cid: '$_id' }, pipeline: [
                    { $match: { $expr: { $and: [{ $eq: ['$customerId', '$$cid'] }, { $gte: ['$createdAt', d30] }] } } },
                    { $limit: 1 }
                ], as: 'recentSales' } },
                { $match: { recentSales: { $size: 0 } } },
                { $project: { name: 1, email: 1, phone: 1, category: 1 } },
                { $limit: 20 }
            ])
        ]);

        res.json({ success: true, topClients, inactiveClients });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─── PRICE HISTORY ───────────────────────────────────────────────────────────
exports.getPriceHistory = async (req, res) => {
    try {
        const history = await PriceHistory.find({
            productId: req.params.productId,
            companyId: req.user.company._id
        }).sort({ createdAt: -1 }).limit(20);
        res.json({ success: true, history });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─── INVOICE TEMPLATES ───────────────────────────────────────────────────────
exports.getInvoiceTemplates = async (req, res) => {
    try {
        const templates = await InvoiceTemplate.find({ companyId: req.user.company._id }).sort({ name: 1 });
        res.json({ success: true, templates });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.saveInvoiceTemplate = async (req, res) => {
    try {
        const { name, clientId, clientName, clientNUIT, items, notes } = req.body;
        if (!name || !items?.length) {
            return res.status(400).json({ success: false, message: 'Nome e itens são obrigatórios.' });
        }
        const template = await InvoiceTemplate.create({
            companyId: req.user.company._id, name, clientId, clientName, clientNUIT, items, notes
        });
        res.json({ success: true, template });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.deleteInvoiceTemplate = async (req, res) => {
    try {
        await InvoiceTemplate.findOneAndDelete({ _id: req.params.id, companyId: req.user.company._id });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─── PRODUCT IMPORT (Excel) ─────────────────────────────────────────────────
exports.importProducts = async (req, res) => {
    try {
        const ExcelJS = require('exceljs');
        if (!req.file) return res.status(400).json({ success: false, message: 'Ficheiro Excel é obrigatório.' });

        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(req.file.buffer);
        const sheet = workbook.worksheets[0];
        if (!sheet) return res.status(400).json({ success: false, message: 'Ficheiro Excel vazio.' });

        const companyId = req.user.company._id;
        const products = [];
        let skipped = 0;

        sheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return; // skip header
            const description = String(row.getCell(1).value || '').trim();
            const unitPrice = parseFloat(row.getCell(2).value) || 0;
            const costPrice = parseFloat(row.getCell(3).value) || 0;
            const stockQty = parseFloat(row.getCell(4).value) || 0;
            const stockMin = parseFloat(row.getCell(5).value) || 0;
            const sku = String(row.getCell(6).value || '').trim();
            const barcode = String(row.getCell(7).value || '').trim();
            const unit = String(row.getCell(8).value || 'un').trim().toLowerCase();

            if (description && unitPrice > 0) {
                products.push({
                    companyId, description, unitPrice, costPrice, barcode, sku,
                    stock: { quantity: stockQty, min: stockMin },
                    unit: ['un', 'kg', 'lt', 'cx'].includes(unit) ? unit : 'un',
                    active: true
                });
            } else {
                skipped++;
            }
        });

        if (!products.length) {
            return res.status(400).json({ success: false, message: 'Nenhum produto válido encontrado no ficheiro.' });
        }

        const result = await Product.insertMany(products);

        res.json({
            success: true,
            message: `${result.length} produtos importados com sucesso.${skipped > 0 ? ` ${skipped} linhas ignoradas.` : ''}`,
            imported: result.length,
            skipped
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
