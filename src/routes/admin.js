const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middlewares/authMiddleware');
const { requireSuperAdmin } = require('../middlewares/requireSuperAdmin');
const admin = require('../controllers/adminController');

// Setup inicial (sem auth — apenas quando não há SUPERADMIN)
router.post('/setup', admin.setupSuperAdmin);
router.post('/create-superadmin', admin.createSuperAdmin);

// Endpoint público — banner global (qualquer utilizador autenticado pode ler)
router.get('/banner/public', admin.getPublicBanner);

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
router.patch('/companies/:id', admin.updateCompany);
router.delete('/companies/:id', admin.deleteCompany); // ?hard=true → hard delete
router.patch('/companies/:id/status', admin.setCompanyStatus);
router.post('/companies/:id/wipe-transactional', admin.wipeCompanyData);
router.get('/companies/:id/export', admin.exportCompanyData);
router.post('/companies/:id/force-logout', admin.forceLogoutCompany);
router.get('/companies/:id/payments', admin.getCompanyPayments);
router.post('/companies/:id/email', admin.emailCompany);
router.patch('/companies/:companyId/extend', admin.extendSubscription);
router.patch('/companies/:companyId/change-plan', admin.changePlanKeepExpiry);

// Utilizadores
router.get('/users', admin.listUsers);
router.post('/users/promote', admin.promoteSuperAdmin);
router.patch('/users/:id/status', admin.setUserStatus);
router.post('/users/:id/force-logout', admin.forceLogoutUser);
router.post('/users/:id/force-password-reset', admin.forcePasswordReset);

// Impersonate
router.post('/impersonate', admin.impersonate);

// Insights de negócio
router.get('/metrics', admin.getBusinessMetrics);
router.get('/companies-top', admin.getTopCompanies);
router.get('/companies-inactive', admin.getInactiveCompanies);
router.get('/churn-risk', admin.getChurnRisk);

// Auditoria
router.get('/login-audit', admin.getLoginAudit);

// System settings (banner + maintenance)
router.get('/system-settings', admin.getSystemSettings);
router.patch('/system-settings/banner', admin.updateBanner);
router.patch('/system-settings/maintenance', admin.setMaintenanceMode);

// DB health + backup
router.get('/db-health', admin.getDbHealth);
router.get('/backup', admin.manualBackup);

// Email broadcast + templates
router.post('/email-broadcast', admin.emailBroadcast);
router.get('/email-templates', admin.listEmailTemplates);
router.put('/email-templates/:key', admin.upsertEmailTemplate);

// Error logs
router.get('/error-logs', admin.getErrorLogs);
router.delete('/error-logs', admin.clearErrorLogs);

// Gestão de planos
router.get('/plans', admin.getPlans);
router.put('/plans/:name', admin.updatePlan);

// Actividades (todas as empresas)
router.get('/activities', admin.getAllActivities);

// Dados de pagamento
router.get('/payment-settings', admin.getPaymentSettings);
router.post('/payment-settings', admin.updatePaymentSettings);

module.exports = router;
