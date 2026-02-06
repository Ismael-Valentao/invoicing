const mongoose = require('mongoose');
const ExcelJS = require('exceljs');
require("dotenv").config()
const Company = require('../models/company');
const User = require('../models/user');
const Subscription = require('../models/subscription');

// 🔌 Conexão MongoDB
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('MongoDB conectado'))
    .catch(err => console.error(err));

async function exportCompaniesToExcel() {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Empresas');

    // 🧾 Cabeçalhos
    sheet.columns = [
        { header: 'Empresa', key: 'company', width: 25 },
        { header: 'Email Empresa', key: 'companyEmail', width: 30 },
        { header: 'Contacto Empresa', key: 'companyContact', width: 20 },
        { header: 'NUIT', key: 'nuit', width: 15 },

        { header: 'Plano', key: 'plan', width: 15 },
        { header: 'Subscrição Ativa', key: 'subStatus', width: 18 },
        { header: 'Expira em', key: 'expiresAt', width: 20 },

        { header: 'Usuários', key: 'users', width: 40 },

        { header: 'Banco', key: 'bank', width: 20 },
        { header: 'Conta', key: 'account', width: 25 },
        { header: 'NIB / NUIB', key: 'nib', width: 25 }
    ];

    // 🎨 Estilo do cabeçalho
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

    const companies = await Company.find();

    console.log(companies)

    for (const company of companies) {
        const users = await User.find({ companyId: company._id });
        const subscription = await Subscription.findOne({ companyId: company._id });

        sheet.addRow({
            company: company.name,
            companyEmail: company.email,
            companyContact: company.contact,
            nuit: company.nuit,

            plan: subscription?.plan || 'FREE',
            subStatus: subscription?.status || 'N/A',
            expiresAt: subscription?.expiresAt
                ? subscription.expiresAt.toISOString().split('T')[0]
                : '—',

            users: users.length
                ? users.map(u => `${u.name} (${u.email})`).join(', ')
                : '—',

            bank: company.bankDetails?.bank || '—',
            account: company.bankDetails?.account_name || '—',
            nib: company.bankDetails?.nib || company.bankDetails?.nuib || '—'
        });
    }

    // 📦 Salvar ficheiro
    const fileName = `./reports/empresas_${Date.now()}.xlsx`;
    await workbook.xlsx.writeFile(fileName);

    console.log(`✅ Excel gerado com sucesso: ${fileName}`);
    process.exit();
}

exportCompaniesToExcel();
