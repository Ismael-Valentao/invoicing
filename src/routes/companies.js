const express = require('express');
const router = express.Router();
require('dotenv').config();
const { createCompany, getCompanies, getCompanyById, updateCompany, deleteCompany, upload, registCompanyLogo, registCompanyLogoProdVersion, getCompany, updateCompanyBank, updateBankDetailsVisibility, getBankDetailsVisibility } = require('../controllers/companyController');
const { authMiddleware } = require('../middlewares/authMiddleware');
const { nextMiddleware } = require('../middlewares/nextMiddleware');

const logoUploadMiddleware = process.env.NODE_ENV.toLowerCase() === 'production' ? nextMiddleware : upload.single("logo");
const logoHandler = process.env.NODE_ENV.toLowerCase() === 'production' ? registCompanyLogoProdVersion : registCompanyLogo;

router.post('/', createCompany);
router.post('/logo', authMiddleware, logoUploadMiddleware, logoHandler);
router.get('/', authMiddleware, getCompanies);
router.get('/company', authMiddleware, getCompany);
router.get('/:id', authMiddleware, getCompanyById);
router.put('/update-bank', authMiddleware, updateCompanyBank);
router.get(
    '/bank-visibility',
    authMiddleware,
    getBankDetailsVisibility
);

router.put('/update-bank-visibility', authMiddleware, updateBankDetailsVisibility);
router.put('/', authMiddleware, updateCompany);
router.delete('/:id', authMiddleware, deleteCompany);

module.exports = router;