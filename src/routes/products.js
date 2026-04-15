const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const name = (file.originalname || '').toLowerCase();
    if (!name.endsWith('.xlsx') && !name.endsWith('.xls')) {
      return cb(new Error('INVALID_TYPE'));
    }
    cb(null, true);
  }
});

function uploadXlsx(req, res, next) {
  upload.single('file')(req, res, (err) => {
    if (!err) return next();
    const msg = err.message === 'INVALID_TYPE'
      ? 'Apenas ficheiros .xlsx ou .xls são permitidos.'
      : err.code === 'LIMIT_FILE_SIZE'
        ? 'Ficheiro excede o limite de 5 MB.'
        : 'Erro no envio do ficheiro.';
    return res.status(400).json({ status: 'error', message: msg });
  });
}

const { createProduct, getProducts, getProductById, updateProduct, deleteProduct, adjustStock, setActive, deactivateProduct, downloadImportTemplate, importProducts } = require('../controllers/productController');
const { authMiddleware } = require('../middlewares/authMiddleware');
const { checkSubscriptionActive, checkProductLimit } = require('../middlewares/checkPlanLimit');

router.get('/import/template', authMiddleware, downloadImportTemplate);
router.post('/import', authMiddleware, checkSubscriptionActive, uploadXlsx, importProducts);
router.post('/', authMiddleware, checkSubscriptionActive, checkProductLimit, createProduct);
router.get('/', authMiddleware, getProducts);
router.get('/:id', authMiddleware, getProductById);
router.patch('/:id', authMiddleware, checkSubscriptionActive, updateProduct);
router.delete('/:id', authMiddleware, checkSubscriptionActive, deleteProduct);
router.patch("/:id/stock", authMiddleware, checkSubscriptionActive, adjustStock);
router.patch("/:id/active", authMiddleware, checkSubscriptionActive, setActive);
router.patch("/:id/deactivate", authMiddleware, checkSubscriptionActive, deactivateProduct);

module.exports = router;