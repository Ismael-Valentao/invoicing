const express = require('express');
const router = express.Router();
require('dotenv').config();
const { createCompany, quickRegister, getCompanies, getCompanyById, updateCompany, deleteCompany, upload, registCompanyLogo, registCompanyLogoProdVersion, getCompany, updateCompanyBank, addCompanyBank,updateBankDetailsVisibility, getBankDetailsVisibility, deleteCompanyBank, setPrimaryCompanyBank } = require('../controllers/companyController');
const { authMiddleware } = require('../middlewares/authMiddleware');
const { nextMiddleware } = require('../middlewares/nextMiddleware');
const { updateModules } = require("../controllers/companyModulesController");

const logoUploadMiddleware = process.env.NODE_ENV.toLowerCase() === 'production' ? nextMiddleware : upload.single("logo");
const logoHandler = process.env.NODE_ENV.toLowerCase() === 'production' ? registCompanyLogoProdVersion : registCompanyLogo;

router.post('/', createCompany);
router.post('/quick-register', quickRegister);

// Public: count of recent signups (no auth)
router.get('/recent-count', async (req, res) => {
    try {
        const Company = require('../models/company');
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const count = await Company.countDocuments({ createdAt: { $gte: weekAgo } });
        res.json({ success: true, count: Math.max(count, 10) }); // minimum 10 for social proof
    } catch (e) { res.json({ success: true, count: 10 }); }
});
router.post('/logo', authMiddleware, logoUploadMiddleware, logoHandler);
router.get('/', authMiddleware, getCompanies);
router.get('/company', authMiddleware, getCompany);
router.patch("/modules", authMiddleware, updateModules);
router.get('/:id', authMiddleware, getCompanyById);
router.put('/update-bank', authMiddleware, updateCompanyBank);
router.get(
    '/bank-visibility',
    authMiddleware,
    getBankDetailsVisibility
);
router.post('/banks', authMiddleware, addCompanyBank);
router.patch('/banks/:bankId', authMiddleware, updateCompanyBank);
router.delete('/banks/:bankId', authMiddleware, deleteCompanyBank);
router.patch('/banks/:bankId/primary', authMiddleware, setPrimaryCompanyBank);
router.put('/update-bank-visibility', authMiddleware, updateBankDetailsVisibility);
router.put('/', authMiddleware, updateCompany);
router.delete('/:id', authMiddleware, deleteCompany);

// Currency & invoice template
router.patch('/preferences', authMiddleware, async (req, res) => {
    try {
        const Company = require('../models/company');
        const { currency, invoiceTemplate } = req.body;
        const update = {};
        if (currency) update.currency = currency;
        if (invoiceTemplate) update.invoiceTemplate = invoiceTemplate;
        await Company.findByIdAndUpdate(req.user.company._id, { $set: update });
        res.json({ success: true, message: 'Preferências actualizadas.' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;