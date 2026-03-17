const User = require('../models/user');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const ALL_PERMISSIONS_TRUE = {
    dashboard: true,
    sales: true,
    stock: true,
    invoicing: true,
    products: true,
    customers: true,
    suppliers: true,
    reports: true,
    settings: true,
    users: true
};

function normalizePermissions(permissions = {}, role = 'USER') {
    if (role === 'ADMIN') {
        return { ...ALL_PERMISSIONS_TRUE };
    }

    return {
        dashboard: !!permissions.dashboard,
        sales: !!permissions.sales,
        stock: !!permissions.stock,
        invoicing: !!permissions.invoicing,
        products: !!permissions.products,
        customers: !!permissions.customers,
        suppliers: !!permissions.suppliers,
        reports: !!permissions.reports,
        settings: !!permissions.settings,
        users: !!permissions.users
    };
}

exports.createUser = async (req, res) => {
    try {
        const authUser = req.user;

        if (!authUser || authUser.role !== 'ADMIN') {
            return res.status(403).json({
                status: 'error',
                message: 'Sem permissão para criar utilizadores'
            });
        }

        const { name, email, contact, permissions, role } = req.body;

        if (!name || !email) {
            return res.status(400).json({
                status: 'error',
                message: 'Nome e e-mail são obrigatórios'
            });
        }

        const normalizedEmail = email.toLowerCase().trim();

        const existingUser = await User.findOne({ email: normalizedEmail });
        if (existingUser) {
            return res.status(400).json({
                status: 'error',
                message: 'Já existe um utilizador com este e-mail'
            });
        }

        const safeRole = ['ADMIN', 'USER'].includes(role) ? role : 'USER';

        const tempPassword = crypto.randomBytes(4).toString('hex');
        const hashedPassword = await bcrypt.hash(tempPassword, 10);

        const user = await User.create({
            name: name.trim(),
            email: normalizedEmail,
            password: hashedPassword,
            contact: contact?.trim() || '',
            companyId: authUser.company._id,
            role: safeRole,
            permissions: normalizePermissions(permissions, safeRole),
            createdBy: authUser._id,
            mustChangePassword: true,
            status: 'active',
            emailVerified: true
        });

        return res.status(201).json({
            status: 'success',
            message: 'Utilizador criado com sucesso',
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                contact: user.contact,
                role: user.role,
                permissions: user.permissions,
                status: user.status
            },
            temporaryPassword: tempPassword
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            status: 'error',
            message: 'Erro ao criar utilizador'
        });
    }
};

exports.listUsers = async (req, res) => {
    try {
        const authUser = req.user;

        if (!authUser || authUser.role !== 'ADMIN') {
            return res.status(403).json({
                status: 'error',
                message: 'Sem permissão'
            });
        }

        const users = await User.find({
            companyId: authUser.company._id
        })
            .select('-password -emailVerificationToken -emailVerificationExpires -passwordResetToken -passwordResetExpires')
            .sort({ createdAt: -1 });

        return res.json({
            status: 'success',
            users
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            status: 'error',
            message: 'Erro ao listar utilizadores'
        });
    }
};

exports.getUserById = async (req, res) => {
    try {
        const authUser = req.user;
        const { id } = req.params;

        if (!authUser || authUser.role !== 'ADMIN') {
            return res.status(403).json({
                status: 'error',
                message: 'Sem permissão'
            });
        }

        const user = await User.findOne({
            _id: id,
            companyId: authUser.company._id
        }).select('-password -emailVerificationToken -emailVerificationExpires -passwordResetToken -passwordResetExpires');

        if (!user) {
            return res.status(404).json({
                status: 'error',
                message: 'Utilizador não encontrado'
            });
        }

        return res.json({
            status: 'success',
            user
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            status: 'error',
            message: 'Erro ao obter utilizador'
        });
    }
};

exports.updateUser = async (req, res) => {
    try {
        const authUser = req.user;
        const { id } = req.params;
        const { name, email, contact, role, status, permissions } = req.body;

        if (!authUser || authUser.role !== 'ADMIN') {
            return res.status(403).json({
                status: 'error',
                message: 'Sem permissão'
            });
        }

        const user = await User.findOne({
            _id: id,
            companyId: authUser.company._id
        });

        if (!user) {
            return res.status(404).json({
                status: 'error',
                message: 'Utilizador não encontrado'
            });
        }

        const isSelf = String(user._id) === String(authUser._id);

        if (name) user.name = name.trim();

        if (email) {
            const normalizedEmail = email.toLowerCase().trim();

            const existingUser = await User.findOne({
                email: normalizedEmail,
                _id: { $ne: user._id }
            });

            if (existingUser) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Já existe um utilizador com este e-mail'
                });
            }

            user.email = normalizedEmail;
        }

        user.contact = contact?.trim() || '';

        const safeRole = ['ADMIN', 'USER'].includes(role) ? role : user.role;

        if (isSelf && safeRole !== 'ADMIN') {
            return res.status(400).json({
                status: 'error',
                message: 'Não pode remover o seu próprio papel de ADMIN'
            });
        }

        user.role = safeRole;
        user.permissions = normalizePermissions(permissions, safeRole);

        if (status && ['active', 'blocked'].includes(status)) {
            if (isSelf && status === 'blocked') {
                return res.status(400).json({
                    status: 'error',
                    message: 'Não pode bloquear a sua própria conta'
                });
            }

            user.status = status;
        }

        await user.save();

        return res.json({
            status: 'success',
            message: 'Utilizador actualizado com sucesso',
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                contact: user.contact,
                role: user.role,
                permissions: user.permissions,
                status: user.status
            }
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            status: 'error',
            message: 'Erro ao actualizar utilizador'
        });
    }
};

exports.updateUserStatus = async (req, res) => {
    try {
        const authUser = req.user;
        const { id } = req.params;
        const { status } = req.body;

        if (!authUser || authUser.role !== 'ADMIN') {
            return res.status(403).json({
                status: 'error',
                message: 'Sem permissão'
            });
        }

        if (!['active', 'blocked'].includes(status)) {
            return res.status(400).json({
                status: 'error',
                message: 'Estado inválido'
            });
        }

        const user = await User.findOne({
            _id: id,
            companyId: authUser.company._id
        });

        if (!user) {
            return res.status(404).json({
                status: 'error',
                message: 'Utilizador não encontrado'
            });
        }

        if (String(user._id) === String(authUser._id) && status === 'blocked') {
            return res.status(400).json({
                status: 'error',
                message: 'Não pode bloquear a sua própria conta'
            });
        }

        user.status = status;
        await user.save();

        return res.json({
            status: 'success',
            message: 'Estado do utilizador actualizado com sucesso'
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            status: 'error',
            message: 'Erro ao actualizar estado do utilizador'
        });
    }
};

exports.verifyEmail = async (req, res) => {
    try {
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
    } catch (error) {
        console.error(error);
        return res.status(500).send('Erro ao verificar e-mail');
    }
};

exports.resendVerification = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                message: 'E-mail é obrigatório'
            });
        }

        const user = await User.findOne({ email: email.toLowerCase().trim() });

        if (!user || user.emailVerified) {
            return res.sendStatus(204);
        }

        const verificationToken = crypto.randomBytes(32).toString('hex');
        const hashedToken = crypto
            .createHash('sha256')
            .update(verificationToken)
            .digest('hex');

        user.emailVerificationToken = hashedToken;
        user.emailVerificationExpires = Date.now() + 60 * 60 * 1000;
        await user.save();

        const verifyUrl = `${process.env.NODE_ENV?.toLowerCase() === "development"
            ? process.env.APP_URL_LOCAL
            : process.env.APP_URL}/api/users/verify-email/${verificationToken}`;

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