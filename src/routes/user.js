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

const { authMiddleware, authMiddleware2 } = require('../middlewares/authMiddleware');
const { requireAdmin } = require("../middlewares/requireAdmin");

// públicas
router.get('/verify-email/:token', verifyEmail);
router.post('/resend-verification', resendVerification);

// ─── Perfil do próprio utilizador ────────────────────────────────────────────
router.patch('/profile', authMiddleware, async (req, res) => {
    try {
        const User = require('../models/user');
        const { name } = req.body;
        if (!name || !String(name).trim()) return res.status(400).json({ success: false, message: 'Nome é obrigatório.' });
        await User.findByIdAndUpdate(req.user.id, { $set: { name: String(name).trim() } });
        return res.json({ success: true, message: 'Perfil actualizado.' });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

router.patch('/profile/password', authMiddleware, async (req, res) => {
    try {
        const User = require('../models/user');
        const bcrypt = require('bcryptjs');
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) return res.status(400).json({ success: false, message: 'Preenche todos os campos.' });
        if (newPassword.length < 8) return res.status(400).json({ success: false, message: 'A nova password deve ter pelo menos 8 caracteres.' });

        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ success: false, message: 'Utilizador não encontrado.' });
        if (!bcrypt.compareSync(currentPassword, user.password)) {
            return res.status(401).json({ success: false, message: 'Password actual incorrecta.' });
        }

        user.password = bcrypt.hashSync(newPassword, 10);
        user.mustChangePassword = false;
        await user.save();
        return res.json({ success: true, message: 'Password alterada com sucesso.' });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

// gestão de utilizadores
router.get('/', authMiddleware2, requireAdmin, listUsers);
router.get('/:id', authMiddleware2, requireAdmin, getUserById);
router.post('/', authMiddleware2, requireAdmin, createUser);
router.patch('/:id', authMiddleware2, requireAdmin, updateUser);
router.patch('/:id/status', authMiddleware2, requireAdmin, updateUserStatus);

module.exports = router;