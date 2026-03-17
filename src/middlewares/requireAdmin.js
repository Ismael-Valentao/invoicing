const requireAdmin = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            status: 'error',
            message: 'Não autenticado'
        });
    }

    if (req.user.role !== 'ADMIN') {
        return res.status(403).json({
            status: 'error',
            message: 'Apenas administradores podem executar esta ação'
        });
    }

    next();
};

module.exports = {requireAdmin}