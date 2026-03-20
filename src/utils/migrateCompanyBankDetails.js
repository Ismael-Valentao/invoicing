const mongoose = require('mongoose');
require('dotenv').config();

const Company = require('../models/company');

const MONGO_URI = process.env.MONGODB_URI_DEV;

async function migrate() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Conectado.');

    const rawCompanies = await Company.collection.find({}).toArray();

    let updated = 0;
    let skipped = 0;

    for (const company of rawCompanies) {
      const old = company.bankDetails;

      if (!old) {
        skipped++;
        continue;
      }

      if (Array.isArray(old)) {
        skipped++;
        continue;
      }

      const hasData =
        old.bank || old.account_name || old.account_number || old.nib || old.nuib;

      const newBankDetails = hasData
        ? [{
            label: 'Conta principal',
            bank: old.bank || '',
            account_name: old.account_name || '',
            account_number: old.account_number || '',
            nib: old.nib || '',
            nuib: old.nuib || '',
            isPrimary: true
          }]
        : [];

      await Company.collection.updateOne(
        { _id: company._id },
        { $set: { bankDetails: newBankDetails } }
      );

      updated++;
    }

    console.log(`Migração concluída. Atualizadas: ${updated}. Ignoradas: ${skipped}`);
    process.exit(0);
  } catch (error) {
    console.error('Erro na migração:', error);
    process.exit(1);
  }
}

migrate();