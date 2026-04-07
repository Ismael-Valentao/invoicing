const ErrorLog = require('../models/errorLog');

/**
 * Middleware global de captura de erros — regista no ErrorLog e devolve resposta.
 * Deve ser registado por último em server.js (depois de todas as rotas).
 */
function errorLogger(err, req, res, next) {
    const statusCode = err.status || err.statusCode || 500;

    // Não loga 4xx (erros do cliente) excepto 401/403 suspeitos
    if (statusCode >= 500 || statusCode === 401 || statusCode === 403) {
        ErrorLog.create({
            message: err.message || 'Erro desconhecido',
            stack: err.stack || '',
            method: req.method,
            url: req.originalUrl,
            statusCode,
            userId: req.user?.id || null,
            companyId: req.user?.company?._id || null,
            userAgent: req.get('user-agent') || '',
            ip: (req.headers['x-forwarded-for']?.split(',')[0] || req.ip || '').trim(),
        }).catch(() => { /* não bloqueia resposta */ });
    }

    if (res.headersSent) return next(err);

    res.status(statusCode).json({
        success: false,
        message: process.env.NODE_ENV === 'production' && statusCode >= 500
            ? 'Erro interno do servidor.'
            : err.message || 'Erro.',
    });
}

module.exports = { errorLogger };
