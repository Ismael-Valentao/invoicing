const User = require("../models/user");
const crypto = require("crypto");
const bcrypt = require('bcryptjs');

// helper: base URL do app
function getAppBaseUrl() {
    return process.env.NODE_ENV?.toLowerCase() === "development"
        ? process.env.APP_URL_LOCAL
        : process.env.APP_URL;
}


// POST /api/users/forgot-password
exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ message: "E-mail é obrigatório" });
        }

        const user = await User.findOne({ email: email.trim().toLowerCase() });

        // Resposta genérica (não revelar se existe ou não)
        const generic = {
            status: "success",
            message: "Se este e-mail existir no sistema, receberá um link de redefinição."
        };

        if (!user) return res.status(200).json(generic);

        // (Opcional) se queres permitir reset só para emails verificados:
        // if (!user.emailVerified) return res.status(200).json(generic);

        // Gerar token
        const resetToken = crypto.randomBytes(32).toString("hex");
        const hashed = crypto.createHash("sha256").update(resetToken).digest("hex");

        user.passwordResetToken = hashed;
        user.passwordResetExpires = Date.now() + 60 * 60 * 1000; // 1 hora
        await user.save();

        const resetUrl = `${getAppBaseUrl()}/reset-password/${resetToken}`;

        // Enviar e-mail (mesma abordagem que usaste no verify)
        // Cria/usa uma API tua de email para reset:
        // MAIL_RESET_PASSWORD_API_URL

        fetch(process.env.MAIL_RESET_PASSWORD_API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                user_email: user.email,
                user_name: user.name || "Utilizador",
                reset_url: resetUrl
            })
        }).catch(console.error);

        return res.status(200).json(generic);

    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Erro ao processar recuperação de palavra-passe" });
    }
};

// POST /api/users/reset-password/:token
exports.resetPassword = async (req, res) => {
    try {
        const { token } = req.params;
        const { password } = req.body;

        if (!token) return res.status(400).json({ message: "Token é obrigatório" });
        if (!password || password.length < 8) {
            return res.status(400).json({ message: "A palavra-passe deve ter no mínimo 8 caracteres" });
        }

        const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

        const user = await User.findOne({
            passwordResetToken: hashedToken,
            passwordResetExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ message: "Link inválido ou expirado" });
        }

        // Atualizar password (assumindo pre-save hash no model)
        const hashedPassword = bcrypt.hashSync(password, 10);
        user.password = hashedPassword;

        // Limpar token
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;

        await user.save();

        return res.status(200).json({ status: "success", message: "Palavra-passe atualizada com sucesso" });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Erro ao redefinir palavra-passe" });
    }
};