const User = require('../models/user');
const crypto = require('crypto');


exports.verifyEmail = async (req, res) => {
    const { token } = req.params;

    const hashedToken = crypto
        .createHash('sha256')
        .update(token)
        .digest('hex');

    const user = await User.findOne({
        emailVerificationToken: hashedToken,
        emailVerificationExpires: { $gt: Date.now() }
    });

    if (!user) {
        return res.status(400).send('Link inválido ou expirado');
    }

    user.emailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;

    await user.save();

    return res.redirect('/login?verified=true');
};

exports.resendVerification = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                message: 'E-mail é obrigatório'
            });
        }

        const user = await User.findOne({ email });

        // Não revelar se o e-mail existe ou não (boa prática)
        if (!user || user.emailVerified) {
            return res.sendStatus(204);
        }

        // Gerar novo token
        const verificationToken = crypto.randomBytes(32).toString('hex');
        const hashedToken = crypto
            .createHash('sha256')
            .update(verificationToken)
            .digest('hex');

        user.emailVerificationToken = hashedToken;
        user.emailVerificationExpires = Date.now() + 60 * 60 * 24000; // 1h
        await user.save();

        const verifyUrl = `${process.env.NODE_ENV.toLowerCase() === "development" ? process.env.APP_URL_LOCAL :  process.env.APP_URL}/api/users/verify-email/${verificationToken}`;

        // Enviar e-mail
        fetch(process.env.MAIL_VERIFICATION_API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                user_email: user.email,
                user_name: user.name,
                verify_url: verifyUrl
            })
        }).catch(console.error);

        return res.status(200).json({
            status: 'success',
            message: 'E-mail de verificação reenviado com sucesso'
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            message: 'Erro ao reenviar e-mail de verificação'
        });
    }
};


