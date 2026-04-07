const ErrorLog = require('../models/errorLog');

/**
 * Persiste um erro no ErrorLog. Pode ser chamado directamente a partir de um catch
 * num controlador (sem precisar de propagar via next(err)).
 */
function logError(err, req = null, statusCode = null) {
    try {
        const code = statusCode || err.status || err.statusCode || 500;
        ErrorLog.create({
            message: err.message || 'Erro desconhecido',
            stack: err.stack || '',
            method: req?.method || '',
            url: req?.originalUrl || '',
            statusCode: code,
            userId: req?.user?.id || null,
            companyId: req?.user?.company?._id || null,
            userAgent: req?.get?.('user-agent') || '',
            ip: ((req?.headers?.['x-forwarded-for']?.split(',')[0]) || req?.ip || '').trim(),
        }).catch(() => { /* nunca bloqueia */ });
    } catch (_) { /* silent */ }
}

/**
 * Middleware global de captura — para erros que cheguem via next(err).
 * Deve ser registado por último em server.js.
 */
function errorLogger(err, req, res, next) {
    const statusCode = err.status || err.statusCode || 500;
    if (statusCode >= 500 || statusCode === 401 || statusCode === 403) {
        logError(err, req, statusCode);
    }
    if (res.headersSent) return next(err);
    res.status(statusCode).json({
        success: false,
        message: process.env.NODE_ENV === 'production' && statusCode >= 500
            ? 'Erro interno do servidor.'
            : err.message || 'Erro.',
    });
}

/**
 * Wrapper para handlers async — apanha erros e envia para o errorLogger.
 * Usar como: router.get('/foo', asyncHandler(controller.foo))
 */
function asyncHandler(fn) {
    return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

module.exports = { errorLogger, logError, asyncHandler };
