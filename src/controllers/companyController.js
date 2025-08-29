const company = require('../models/company');
const User = require('../models/user');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const logoDir = path.join(path.dirname(path.dirname(__dirname)), 'public', 'images', 'logos');

if (!fs.existsSync(logoDir)) {
    fs.mkdirSync(logoDir);
}

exports.createCompany = async (req, res) => {
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
        if (!name || !address || !contact || !email || !nuit || !firstName || !lastName || !useremail || !usercontact || !userpassword) {
            return res.status(400).json({
                message: 'All fields are required'
            });
        }

        const existingCompany = await company.find({
            name
        });
        if (existingCompany.length > 0) {
            return res.status(400).json({
                message: 'Company already exists'
            });
        }

        const newCompany = new company(req.body);
        await newCompany.save();
        const existingUser = await User.find({
            email: email,
            companyId: newCompany._id
        });
        if (existingUser.length > 0) {
            return res.status(400).json({
                error: 'Usuário já existe'
            });
        }

        const hashedPassword = bcrypt.hashSync(userpassword, 10);

        const user = new User({
            name: `${firstName} ${lastName}`,
            email: useremail,
            contact: usercontact,
            password: hashedPassword,
            companyId: newCompany._id
        })

        await user.save();

        res.status(201).json({
            status: 'success',
            message: 'Company created successfully',
            company: newCompany,
            user
        });
    } catch (error) {
        res.status(500).json({
            message: 'Error creating company',
            error
        });
        console.log(error);
    }
}

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

}

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
        const {companyNUIT, companyContact, companyEmail, companyAddress} = req.body;
        const data = {
            address: companyAddress,
            contact: companyContact,
            email: companyEmail,
            nuit: companyNUIT,
        }
        const updatedCompany = await company.findByIdAndUpdate({_id:companyId}, data, {
            new: true
        });
        if (!updatedCompany) {
            return res.status(404).json({
                message: 'Company not found'
            });
        }
        res.status(200).json({
            status:'success',
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
    const companyId = req.user.company._id;
    const theCompany = await company.findOne({
        _id: companyId
    });

    if (!theCompany) {
        return res.status(404).json({
            error: 'Empresa não encontrada'
        });
    }

    theCompany.logoUrl = logoFileName;

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