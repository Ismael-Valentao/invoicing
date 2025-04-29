const registerValidation = (req, res, next) => {
    const { email, password, companyId } = req.body;
    if (!email || !password || !companyId) {
        return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
    }
    if (password.length < 6) {
        return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: 'Email inválido' });
    }
    next();
}

const loginValidation = (req, res, next) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: 'Email inválido' });
    }
    next();
}

module.exports = { registerValidation, loginValidation };