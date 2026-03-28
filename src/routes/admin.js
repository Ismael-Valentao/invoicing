const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middlewares/authMiddleware');
const { requireSuperAdmin } = require('../middlewares/requireSuperAdmin');
const admin = require('../controllers/adminController');

// Setup inicial (sem auth — apenas quando não há SUPERADMIN)
router.post('/setup', admin.setupSuperAdmin);
router.post('/create-superadmin', admin.createSuperAdmin);

// Todas as rotas seguintes exigem SUPERADMIN
router.use(authMiddleware, requireSuperAdmin);

// Stats
router.get('/stats', admin.getDashboardStats);

// Subscrições
router.get('/subscriptions', admin.listSubscriptions);
router.post('/subscriptions/activate', admin.activatePlan);
router.post('/subscriptions/cancel', admin.cancelSubscription);

// Empresas
router.get('/companies', admin.listCompanies);
router.get('/companies/:id', admin.getCompanyDetail);

// Utilizadores
router.get('/users', admin.listUsers);
router.post('/users/promote', admin.promoteSuperAdmin);

// Dados de pagamento
router.get('/payment-settings', admin.getPaymentSettings);
router.post('/payment-settings', admin.updatePaymentSettings);

module.exports = router;
