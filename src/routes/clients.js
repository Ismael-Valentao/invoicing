const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const {createClient, getClients, getClientById, updateClient, deleteClient, downloadImportTemplate, importClients} = require('../controllers/clientController');
const {authMiddleware} = require('../middlewares/authMiddleware');
const { checkSubscriptionActive, checkClientLimit } = require('../middlewares/checkPlanLimit');

router.get('/import/template', authMiddleware, downloadImportTemplate);
router.post('/import', authMiddleware, checkSubscriptionActive, upload.single('file'), importClients);
router.post('/', authMiddleware, checkSubscriptionActive, checkClientLimit, createClient);
router.get('/', authMiddleware, getClients);
router.get('/:id', authMiddleware, getClientById);
router.patch('/:id', authMiddleware, checkSubscriptionActive, updateClient);
router.delete('/:id', authMiddleware, checkSubscriptionActive, deleteClient);


module.exports = router;