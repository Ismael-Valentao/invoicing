const rateLimit = require('express-rate-limit');

module.exports = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,

    message: {
        success: false,
        message: 'Muitas tentativas de login. Tente novamente em 15 minutos.'
    }
});
