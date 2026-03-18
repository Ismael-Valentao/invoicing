const mongoose = require('mongoose');
require('dotenv').config();

const Company = require('../models/company');

const MONGO_URI =
  process.env.NODE_ENV?.toLowerCase() === 'development'
    ? process.env.MONGODB_LOCAL_URI
    : process.env.MONGODB_URI_DEV;

async function migrate() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Conectado.');

    const companies = await Company.find({});

    let updated = 0;

    for (const company of companies) {
      if (!company.bankDetails) continue;

      // se já for array, ignora
      if (Array.isArray(company.bankDetails)) continue;

      const old = company.bankDetails;

      if (old.bank || old.account_name || old.account_number || old.nib || old.nuib) {
        company.bankDetails = [{
          label: 'Conta principal',
          bank: old.bank || '',
          account_name: old.account_name || '',
          account_number: old.account_number || '',
          nib: old.nib || '',
          nuib: old.nuib || '',
          isPrimary: true
        }];

        await company.save();
        updated++;
      } else {
        company.bankDetails = [];
        await company.save();
      }
    }

    console.log(`Migração concluída. Empresas atualizadas: ${updated}`);
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

migrate();