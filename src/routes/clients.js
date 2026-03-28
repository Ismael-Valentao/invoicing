const express = require('express');
const router = express.Router();

const {createClient, getClients, getClientById, updateClient, deleteClient} = require('../controllers/clientController');
const {authMiddleware} = require('../middlewares/authMiddleware');
const { checkSubscriptionActive, checkClientLimit } = require('../middlewares/checkPlanLimit');

router.post('/', authMiddleware, checkSubscriptionActive, checkClientLimit, createClient);
router.get('/', authMiddleware, getClients);
router.get('/:id', authMiddleware, getClientById);
router.patch('/:id', authMiddleware, updateClient);
router.delete('/:id', authMiddleware, deleteClient);


module.exports = router;