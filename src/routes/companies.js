const express = require('express');
const router = express.Router();
const { createCompany, getCompanies, getCompanyById, updateCompany, deleteCompany, upload, registCompanyLogo, getCompany } = require('../controllers/companyController');
const {authMiddleware} = require('../middlewares/authMiddleware');

router.post('/', createCompany);
router.post('/logo', authMiddleware, upload.single("logo"), registCompanyLogo);
router.get('/', authMiddleware, getCompanies);
router.get('/company',authMiddleware, getCompany);
router.get('/:id', authMiddleware, getCompanyById);
router.put('/:id', authMiddleware, updateCompany);
router.delete('/:id', authMiddleware, deleteCompany);

module.exports = router;