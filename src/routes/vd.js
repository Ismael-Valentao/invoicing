const express = require('express');
const router = express.Router();

const {
    createVD,
    getVDs,
    getVDById,
    getVDLastNumber,
    getVDsTotalAmount,
    getVDAmountByMonth,
    generateVDPDF
} = require('../controllers/vdController');
const { authMiddleware } = require('../middlewares/authMiddleware');

router.post('/', authMiddleware, createVD);
router.get('/', authMiddleware, getVDs);
router.get('/last-number', authMiddleware, getVDLastNumber);

// Preview do próximo número de VD (sem incrementar)
router.get('/next-number', authMiddleware, async (req, res) => {
    try {
        const Counter = require('../models/counter');
        const { buildNumber } = require('../utils/numerationGenerator');
        const year = new Date().getFullYear();
        const counter = await Counter.findOne({ companyId: req.user.company._id, type: `vd_${year}` });
        const nextVal = (counter?.value || 0) + 1;
        res.json({ success: true, number: buildNumber('VD', year, nextVal) });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});
router.get('/total-amount', authMiddleware, getVDsTotalAmount);
router.get('/amount/months', authMiddleware, getVDAmountByMonth);
router.get('/:id', authMiddleware, getVDById);
router.get('/:id/pdf', authMiddleware, generateVDPDF);

module.exports = router;