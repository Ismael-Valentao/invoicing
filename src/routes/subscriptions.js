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

// Público — lista de planos disponíveis
router.get('/plans', getPlans);

// Utilizador autenticado
router.get('/my', authMiddleware, getMySubscription);
router.post('/request-upgrade', authMiddleware, requestUpgrade);

// Admin apenas
router.get('/admin/all', authMiddleware, requireAdmin, adminListSubscriptions);
router.patch('/admin/activate', authMiddleware, requireAdmin, adminActivatePlan);

module.exports = router;