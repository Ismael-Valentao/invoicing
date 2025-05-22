const express = require('express');
const router = express.Router();
const { createCompany, getCompanies, getCompanyById, updateCompany, deleteCompany, upload, registCompanyLogo } = require('../controllers/companyController');
const {authMiddleware} = require('../middlewares/authMiddleware');

router.post('/', createCompany);
router.post('/logo', authMiddleware, upload.single("logo"), registCompanyLogo);
router.get('/', getCompanies);
router.get('/:id', getCompanyById);
router.put('/:id', updateCompany);
router.delete('/:id', deleteCompany);

module.exports = router;