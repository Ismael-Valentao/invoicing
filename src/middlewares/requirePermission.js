const requirePermission = (permission) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                status: 'error',
                message: 'Não autenticado'
            });
        }

        if (req.user.role === 'ADMIN') {
            return next();
        }

        if (!req.user.permissions || req.user.permissions[permission] !== true) {
            return res.status(403).json({
                status: 'error',
                message: 'Sem permissão para aceder a este módulo'
            });
        }

        next();
    };
};

module.exports = {requirePermission}