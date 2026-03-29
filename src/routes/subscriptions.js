const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middlewares/authMiddleware');
const { requireAdmin } = require('../middlewares/requireAdmin');
const {
    getMySubscription,
    requestUpgrade,
    adminActivatePlan,
    adminListSubscriptions,
    getPlans
} = require('../controllers/subscriptionController');
const PaymentSettings = require('../models/paymentSettings');
const RecurringInvoice = require('../models/recurringInvoice');

// Público — lista de planos disponíveis
router.get('/plans', getPlans);

// Público — dados de pagamento (M-Pesa, E-mola, banco)
router.get('/payment-settings', async (req, res) => {
    try {
        let settings = await PaymentSettings.findOne();
        if (!settings) settings = {};
        res.json({ success: true, settings });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Utilizador autenticado
router.get('/my', authMiddleware, getMySubscription);
router.post('/request-upgrade', authMiddleware, requestUpgrade);

// Facturas recorrentes
router.get('/recurring-invoices', authMiddleware, async (req, res) => {
    try {
        const items = await RecurringInvoice.find({ companyId: req.user.company._id }).sort({ createdAt: -1 });
        res.json({ success: true, items });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});
router.post('/recurring-invoices', authMiddleware, async (req, res) => {
    try {
        const { clientId, clientName, clientNUIT, items, subTotal, tax, totalAmount, interval, nextRunDate } = req.body;
        const ri = await RecurringInvoice.create({
            companyId: req.user.company._id, userId: req.user._id,
            clientId, clientName, clientNUIT, items, subTotal, tax, totalAmount,
            interval, nextRunDate
        });
        res.json({ success: true, item: ri });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});
router.patch('/recurring-invoices/:id', authMiddleware, async (req, res) => {
    try {
        await RecurringInvoice.findOneAndUpdate(
            { _id: req.params.id, companyId: req.user.company._id },
            { $set: req.body }
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Admin apenas
router.get('/admin/all', authMiddleware, requireAdmin, adminListSubscriptions);
router.patch('/admin/activate', authMiddleware, requireAdmin, adminActivatePlan);

module.exports = router;