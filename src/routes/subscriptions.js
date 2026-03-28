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

// Admin apenas
router.get('/admin/all', authMiddleware, requireAdmin, adminListSubscriptions);
router.patch('/admin/activate', authMiddleware, requireAdmin, adminActivatePlan);

module.exports = router;