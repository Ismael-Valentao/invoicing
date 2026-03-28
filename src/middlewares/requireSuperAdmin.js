/**
 * Middleware: apenas SUPERADMIN pode aceder.
 * Bloqueia com redirect (páginas) ou JSON (API).
 */
function requireSuperAdmin(req, res, next) {
    if (!req.user) {
        if (req.accepts('html')) return res.redirect('/login');
        return res.status(401).json({ success: false, message: 'Não autenticado.' });
    }
    if (req.user.role !== 'SUPERADMIN') {
        if (req.accepts('html')) return res.status(403).render('404', {
            title: '403',
            user: req.user,
            requestedUrl: req.originalUrl
        });
        return res.status(403).json({ success: false, message: 'Acesso restrito ao painel de administração.' });
    }
    next();
}

module.exports = { requireSuperAdmin };
