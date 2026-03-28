const company = require('../models/company');
const Subscription = require('../models/subscription');
const User = require('../models/user');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const crypto = require('crypto');
const { getFreePlanExpiration } = require("../utils/plans")
require('dotenv').config();

const logoDir = path.join(path.dirname(path.dirname(__dirname)), 'public', 'images', 'logos');

if (!fs.existsSync(logoDir)) {
    fs.mkdirSync(logoDir);
}


exports.createCompany = async (req, res) => {
    const NODE_ENV = process.env.NODE_ENV || 'development';

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto
        .createHash('sha256')
        .update(verificationToken)
        .digest('hex');

    const tokenExpires = Date.now() + 1 * 60 * 60 * 24000; // 1h
    if (NODE_ENV === 'production') {
        const session = await mongoose.startSession();

        try {
            const {
                name,
                address,
                contact,
                email,
                nuit,
                firstName,
                lastName,
                useremail,
                usercontact,
                userpassword
            } = req.body;

            if (!name || !address || !contact || !email || !nuit ||
                !firstName || !lastName || !useremail || !usercontact || !userpassword) {
                return res.status(400).json({ message: "All fields are required" });
            }

            session.startTransaction();

            const existingCompany = await company.findOne({ name }).session(session);
            if (existingCompany) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({ message: "Company already exists" });
            }


            const existingUser = await User.findOne({ email: useremail }).session(session);
            if (existingUser) {
                await session.abortTransaction();
                return res.status(400).json({ message: "Usuário já existe" });
            }

            const newCompany = await company.create([{
                name,
                address,
                contact,
                email,
                nuit,
                showBankDetails: {},
                bankDetails: []
            }], { session });

            const hashedPassword = bcrypt.hashSync(userpassword, 10);

            const user = await User.create([{
                name: `${firstName} ${lastName}`,
                email: useremail,
                contact: usercontact,
                password: hashedPassword,
                companyId: newCompany[0]._id,
                role: 'ADMIN',
                permissions: {
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
                },
                emailVerified: false,
                emailVerificationToken: hashedToken,
                emailVerificationExpires: tokenExpires
            }], { session });


            await Subscription.create([{
                companyId: newCompany[0]._id,
                plan: 'FREE',
                startDate: new Date(),
                expiresAt: getFreePlanExpiration(),
                status: 'active'
            }], { session });


            await session.commitTransaction();
            session.endSession();

            const verifyUrl = `${process.env.NODE_ENV.toLowerCase() === "development" ? process.env.APP_URL_LOCAL : process.env.APP_URL}/api/users/verify-email/${verificationToken}`;

            fetch(process.env.MAIL_VERIFICATION_API_URL, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({
                    user_email: useremail,
                    user_name: `${firstName} ${lastName}`,
                    verify_url: verifyUrl
                })
            }).catch(console.error);

            return res.status(201).json({
                status: "success",
                message: "Company created successfully",
                company: newCompany[0],
                user: user[0]
            });

        } catch (error) {
            if (session) {
                await session.abortTransaction();
                session.endSession();
            }


            console.error(error);
            return res.status(500).json({
                message: "Erro ao criar conta! Por favor, contacte o suporte técnico...",
                error
            });
        }
    }
    else {
        try {
            const {
                name,
                address,
                contact,
                email,
                nuit,
                firstName,
                lastName,
                useremail,
                usercontact,
                userpassword
            } = req.body;

            if (!name || !address || !contact || !email || !nuit ||
                !firstName || !lastName || !useremail || !usercontact || !userpassword) {
                return res.status(400).json({ message: "Todos os campos são obrigatórios" });
            }

            const existingCompany = await company.findOne({ name });
            if (existingCompany) {
                return res.status(400).json({ message: "Empresa já existe" });
            }

            const existingUser = await User.findOne({ email: useremail });
            if (existingUser) {
                return res.status(400).json({ message: "Usuário já existe" });
            }

            const newCompany = await company.create({
                name,
                address,
                contact,
                email,
                nuit,
                showBankDetails: {},
                bankDetails: []
            });

            const hashedPassword = bcrypt.hashSync(userpassword, 10);

            const user = await User.create({
                name: `${firstName} ${lastName}`,
                email: useremail,
                contact: usercontact,
                password: hashedPassword,
                companyId: newCompany._id,
                role: 'ADMIN',
                permissions: {
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
                },
                emailVerified: false,
                emailVerificationToken: hashedToken,
                emailVerificationExpires: tokenExpires
            });


            await Subscription.create([{
                companyId: newCompany._id,
                plan: 'FREE',
                startDate: new Date(),
                expiresAt: getFreePlanExpiration(),
                status: 'active'
            }]);

            const verifyUrl = `${process.env.NODE_ENV.toLowerCase() === "development" ? process.env.APP_URL_LOCAL : process.env.APP_URL}/api/users/verify-email/${verificationToken}`;

            fetch(process.env.MAIL_VERIFICATION_API_URL, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({
                    user_email: useremail,
                    user_name: `${firstName} ${lastName}`,
                    verify_url: verifyUrl
                })
            }).catch(console.error);

            return res.status(201).json({
                status: "success",
                message: "Empresa criada com sucesso",
                company: newCompany,
                user
            });

        } catch (error) {
            console.error(error);

            return res.status(500).json({
                message: "Erro ao criar empresa",
                error
            });
        }
    }
};

exports.getCompany = async (req, res) => {
    const companyId = req.user.company._id;
    try {
        const companyData = await company.findById(companyId);
        if (!companyData) {
            return res.status(404).json({
                message: 'Company not found'
            });
        }

        res.status(200).json({
            status: 'success',
            company: companyData
        });
    } catch (error) {
        res.status(500).json({
            message: 'Error fetching company',
            error
        });
    }
};

exports.getCompanies = async (req, res) => {
    try {
        const companies = await company.find();
        res.status(200).json({
            companies
        });
    } catch (error) {
        res.status(500).json({
            message: 'Error fetching companies',
            error
        });
    }
}

exports.getCompanyById = async (req, res) => {
    try {
        const {
            id
        } = req.params;
        const companyData = await company.findById(id);
        if (!companyData) {
            return res.status(404).json({
                message: 'Company not found'
            });
        }
        res.status(200).json({
            company: companyData
        });
    } catch (error) {
        res.status(500).json({
            message: 'Error fetching company',
            error
        });
    }
}

exports.updateCompany = async (req, res) => {
    try {
        const companyId = req.user.company._id;
        const { companyNUIT, companyContact, companyEmail, companyAddress } = req.body;
        const data = {
            address: companyAddress,
            contact: companyContact,
            email: companyEmail,
            nuit: companyNUIT,
        }
        const updatedCompany = await company.findByIdAndUpdate({ _id: companyId }, data, {
            new: true
        });
        if (!updatedCompany) {
            return res.status(404).json({
                message: 'Company not found'
            });
        }
        res.status(200).json({
            status: 'success',
            message: 'Company updated successfully',
            company: updatedCompany
        });
    } catch (error) {
        res.status(500).json({
            message: 'Error updating company',
            error
        });
    }
}

exports.updateCompanyBank = async (req, res) => {
    try {
        // pega o ID da empresa associada ao usuário logado
        const companyId = req.user.company._id;

        // dados vindos do frontend
        const { bankDetails } = req.body;

        if (!bankDetails) {
            return res.status(400).json({
                message: "Os dados bancários são obrigatórios no body."
            });
        }

        // monta o objeto a atualizar
        const data = {
            bankDetails: {
                bank: bankDetails.bank,
                account_name: bankDetails.account_name,
                account_number: bankDetails.account_number,
                nib: bankDetails.nib,
                nuib: bankDetails.nuib
            }
        };

        // atualiza empresa
        const updatedCompany = await company.findByIdAndUpdate(
            { _id: companyId },
            data,
            { new: true, runValidators: true }
        );

        if (!updatedCompany) {
            return res.status(404).json({
                message: "Company not found"
            });
        }

        res.status(200).json({
            status: "success",
            message: "Dados bancários actualizados com sucesso",
            bankDetails: updatedCompany.bankDetails
        });
    } catch (error) {
        res.status(500).json({
            message: "Erro ao actualizar dados bancários",
            error
        });
    }
};


exports.deleteCompany = async (req, res) => {
    try {
        const {
            id
        } = req.params;
        const deletedCompany = await company.findByIdAndDelete(id);
        if (!deletedCompany) {
            return res.status(404).json({
                message: 'Company not found'
            });
        }
        res.status(200).json({
            message: 'Company deleted successfully'
        });
    } catch (error) {
        res.status(500).json({
            message: 'Error deleting company',
            error
        });
    }
}

let logoFileName = '';
const storage = multer.diskStorage({
    destination: logoDir,
    filename: (req, file, cb) => {
        const companyId = req.user.company._id;
        logoFileName = 'logo_company_v1_' + companyId + path.extname(file.originalname);
        cb(null, 'logo_company_v1_' + companyId + path.extname(file.originalname));
    }
})

exports.upload = multer({
    storage
});

exports.registCompanyLogo = async (req, res) => {
    const { logo_name } = req.body;
    const companyId = req.user.company._id;
    const theCompany = await company.findOne({
        _id: companyId
    });

    if (!theCompany) {
        return res.status(404).json({
            error: 'Empresa não encontrada'
        });
    }

    theCompany.logoUrl = logo_name;

    await theCompany.save();

    return res.status(200).json({
        status: 'success',
        company: theCompany
    })
}

exports.registCompanyLogoProdVersion = async (req, res) => {
    const { logo_name } = req.body;
    const companyId = req.user.company._id;
    const theCompany = await company.findOne({
        _id: companyId
    });

    if (!theCompany) {
        return res.status(404).json({
            error: 'Empresa não encontrada'
        });
    }

    theCompany.logoUrl = logo_name;

    await theCompany.save();

    return res.status(200).json({
        status: 'success',
        company: theCompany
    })
}

exports.updateBankDetailsVisibility = async (req, res) => {
    try {
        const companyId = req.user.company._id;
        const { showBankDetails } = req.body;
        if (!showBankDetails) {
            return res.status(400).json({
                message: "Os dados de visibilidade são obrigatórios no body."
            });
        }
        const data = {
            showBankDetails: {
                invoices: showBankDetails.invoices,
                quotations: showBankDetails.quotations,
                receipts: showBankDetails.receipts,
                vds: showBankDetails.vds
            }
        };

        const updatedCompany = await company.findByIdAndUpdate(
            { _id: companyId },
            data,
            { new: true, runValidators: true }
        );

        if (!updatedCompany) {
            return res.status(404).json({
                message: "Company not found"
            });
        }
        res.status(200).json({
            status: "success",
            message: "Visibilidade dos dados bancários actualizada com sucesso",
            showBankDetails: updatedCompany.showBankDetails
        });
    } catch (error) {
        console.log(error)
        res.status(500).json({
            message: "Erro ao actualizar visibilidade dos dados bancários",
            error
        });
    }
};

// controller
exports.getBankDetailsVisibility = async (req, res) => {
    try {
        const companyId = req.user.company._id;

        const companyData = await company.findById(companyId)
            .select('showBankDetails');

        if (!companyData) {
            return res.status(404).json({ message: 'Company not found' });
        }

        res.status(200).json({
            status: 'success',
            showBankDetails: companyData.showBankDetails
        });

    } catch (error) {
        console.log(error)
        res.status(500).json({
            message: 'Erro ao buscar visibilidade',
            error
        });
    }
};

exports.addCompanyBank = async (req, res) => {
    try {
        const companyId = req.user.company._id;
        const { bankDetails } = req.body;

        if (!bankDetails || !bankDetails.bank || !bankDetails.account_name || !bankDetails.account_number || !bankDetails.nib) {
            return res.status(400).json({
                status: 'error',
                message: 'Preencha os campos obrigatórios dos dados bancários.'
            });
        }

        const theCompany = await company.findById(companyId);

        if (!theCompany) {
            return res.status(404).json({
                status: 'error',
                message: 'Empresa não encontrada'
            });
        }

        const hasPrimary = theCompany.bankDetails.some(item => item.isPrimary);

        const newBank = {
            label: bankDetails.label?.trim() || '',
            bank: bankDetails.bank.trim(),
            account_name: bankDetails.account_name.trim(),
            account_number: bankDetails.account_number.trim(),
            nib: bankDetails.nib.trim(),
            nuib: bankDetails.nuib?.trim() || '',
            isPrimary: bankDetails.isPrimary === true || !hasPrimary
        };

        if (newBank.isPrimary) {
            theCompany.bankDetails.forEach(item => {
                item.isPrimary = false;
            });
        }

        theCompany.bankDetails.push(newBank);
        await theCompany.save();

        return res.status(201).json({
            status: 'success',
            message: 'Dados bancários adicionados com sucesso',
            bankDetails: theCompany.bankDetails
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            status: 'error',
            message: 'Erro ao adicionar dados bancários',
            error
        });
    }
};

exports.updateCompanyBank = async (req, res) => {
    try {
        const companyId = req.user.company._id;
        const { bankId } = req.params;
        const { bankDetails } = req.body;

        const theCompany = await company.findById(companyId);

        if (!theCompany) {
            return res.status(404).json({
                status: 'error',
                message: 'Empresa não encontrada'
            });
        }

        const bankItem = theCompany.bankDetails.id(bankId);

        if (!bankItem) {
            return res.status(404).json({
                status: 'error',
                message: 'Conta bancária não encontrada'
            });
        }

        if (!bankDetails || !bankDetails.bank || !bankDetails.account_name || !bankDetails.account_number || !bankDetails.nib) {
            return res.status(400).json({
                status: 'error',
                message: 'Preencha os campos obrigatórios dos dados bancários.'
            });
        }

        bankItem.label = bankDetails.label?.trim() || '';
        bankItem.bank = bankDetails.bank.trim();
        bankItem.account_name = bankDetails.account_name.trim();
        bankItem.account_number = bankDetails.account_number.trim();
        bankItem.nib = bankDetails.nib.trim();
        bankItem.nuib = bankDetails.nuib?.trim() || '';

        if (bankDetails.isPrimary === true) {
            theCompany.bankDetails.forEach(item => {
                item.isPrimary = String(item._id) === String(bankId);
            });
        }

        await theCompany.save();

        return res.status(200).json({
            status: 'success',
            message: 'Dados bancários actualizados com sucesso',
            bankDetails: theCompany.bankDetails
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            status: 'error',
            message: 'Erro ao actualizar dados bancários',
            error
        });
    }
};

exports.deleteCompanyBank = async (req, res) => {
    try {
        const companyId = req.user.company._id;
        const { bankId } = req.params;

        const theCompany = await company.findById(companyId);

        if (!theCompany) {
            return res.status(404).json({
                status: 'error',
                message: 'Empresa não encontrada'
            });
        }

        const bankItem = theCompany.bankDetails.id(bankId);

        if (!bankItem) {
            return res.status(404).json({
                status: 'error',
                message: 'Conta bancária não encontrada'
            });
        }

        const wasPrimary = bankItem.isPrimary;

        bankItem.deleteOne();
        await theCompany.save();

        if (wasPrimary && theCompany.bankDetails.length > 0) {
            theCompany.bankDetails[0].isPrimary = true;
            await theCompany.save();
        }

        return res.status(200).json({
            status: 'success',
            message: 'Conta bancária removida com sucesso',
            bankDetails: theCompany.bankDetails
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            status: 'error',
            message: 'Erro ao remover conta bancária',
            error
        });
    }
};

exports.setPrimaryCompanyBank = async (req, res) => {
    try {
        const companyId = req.user.company._id;
        const { bankId } = req.params;

        const theCompany = await company.findById(companyId);

        if (!theCompany) {
            return res.status(404).json({
                status: 'error',
                message: 'Empresa não encontrada'
            });
        }

        const bankItem = theCompany.bankDetails.id(bankId);

        if (!bankItem) {
            return res.status(404).json({
                status: 'error',
                message: 'Conta bancária não encontrada'
            });
        }

        theCompany.bankDetails.forEach(item => {
            item.isPrimary = String(item._id) === String(bankId);
        });

        await theCompany.save();

        return res.status(200).json({
            status: 'success',
            message: 'Conta principal definida com sucesso',
            bankDetails: theCompany.bankDetails
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            status: 'error',
            message: 'Erro ao definir conta principal',
            error
        });
    }
};