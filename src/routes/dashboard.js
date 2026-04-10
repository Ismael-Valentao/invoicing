const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middlewares/authMiddleware');
const dashboard = require('../controllers/dashboardController');
const { getActivities } = require('../controllers/activityLogController');

router.get('/low-stock', authMiddleware, dashboard.getLowStock);
router.get('/client-debts', authMiddleware, dashboard.getClientDebts);
router.get('/savings', authMiddleware, dashboard.getSavingsStats);
router.get('/insights', authMiddleware, dashboard.getInsights);
router.get('/greeting', authMiddleware, dashboard.getGreeting);
router.get('/search', authMiddleware, dashboard.globalSearch);
router.get('/product-margins', authMiddleware, dashboard.getProductMargins);
router.get('/expiring-products', authMiddleware, dashboard.getExpiringProducts);
router.get('/profit', authMiddleware, dashboard.getProfitOverview);
router.get('/activities', authMiddleware, getActivities);

module.exports = router;