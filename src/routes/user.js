const express = require('express');
const router = express.Router();

const {
    verifyEmail,
    resendVerification,
    createUser,
    listUsers,
    getUserById,
    updateUser,
    updateUserStatus
} = require("../controllers/userController");

const { authMiddleware2 } = require('../middlewares/authMiddleware');
const { requireAdmin } = require("../middlewares/requireAdmin");

// públicas
router.get('/verify-email/:token', verifyEmail);
router.post('/resend-verification', resendVerification);

// gestão de utilizadores
router.get('/', authMiddleware2, requireAdmin, listUsers);
router.get('/:id', authMiddleware2, requireAdmin, getUserById);
router.post('/', authMiddleware2, requireAdmin, createUser);
router.patch('/:id', authMiddleware2, requireAdmin, updateUser);
router.patch('/:id/status', authMiddleware2, requireAdmin, updateUserStatus);

module.exports = router;