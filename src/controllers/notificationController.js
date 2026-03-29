const Notification = require('../models/notification');
const Product = require('../models/product');
const Invoice = require('../models/invoice');

exports.getNotifications = async (req, res) => {
    try {
        const notifications = await Notification.find({ companyId: req.user.company._id })
            .sort({ createdAt: -1 }).limit(20);
        const unreadCount = await Notification.countDocuments({ companyId: req.user.company._id, read: false });
        res.json({ success: true, notifications, unreadCount });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.markAsRead = async (req, res) => {
    try {
        if (req.params.id === 'all') {
            await Notification.updateMany({ companyId: req.user.company._id }, { $set: { read: true } });
        } else {
            await Notification.findOneAndUpdate(
                { _id: req.params.id, companyId: req.user.company._id },
                { $set: { read: true } }
            );
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// Generate stock-low and overdue-invoice notifications
exports.generateNotifications = async (companyId) => {
    try {
        // Low stock products
        const lowStockProducts = await Product.find({
            companyId,
            active: true,
            'stock.min': { $gt: 0 },
            $expr: { $lte: ['$stock.quantity', '$stock.min'] }
        });

        for (const p of lowStockProducts) {
            const existing = await Notification.findOne({
                companyId, type: 'stock_low',
                'metadata.productId': p._id,
                createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
            });
            if (!existing) {
                await Notification.create({
                    companyId, type: 'stock_low',
                    title: 'Stock baixo',
                    message: `${p.description} tem apenas ${p.stock.quantity} ${p.unit} em stock (mín: ${p.stock.min}).`,
                    icon: 'fas fa-exclamation-triangle', color: 'warning',
                    link: '/products',
                    metadata: { productId: p._id }
                });
            }
        }

        // Overdue invoices
        const overdueInvoices = await Invoice.find({
            companyId, docType: 'invoice', status: 'unpaid',
            dueDate: { $lt: new Date() }
        });

        for (const inv of overdueInvoices) {
            const existing = await Notification.findOne({
                companyId, type: 'invoice_overdue',
                'metadata.invoiceId': inv._id,
                createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
            });
            if (!existing) {
                await Notification.create({
                    companyId, type: 'invoice_overdue',
                    title: 'Factura vencida',
                    message: `Factura ${inv.invoiceNumber} de ${inv.clientName} está vencida.`,
                    icon: 'fas fa-file-invoice', color: 'danger',
                    link: '/invoices',
                    metadata: { invoiceId: inv._id }
                });
            }
        }
    } catch (err) {
        console.error('Error generating notifications:', err.message);
    }
};