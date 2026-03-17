const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../models/user'); // ajusta o caminho se necessário

const MONGO_URI = process.env.MONGODB_URI_DEV;

async function migrateUsersToAdmin() {
  try {
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('Conectado à base de dados.');

    const permissions = {
      dashboard: true,
      sales: true,
      stock: true,
      invoicing: true,
      products: true,
      customers: true,
      suppliers: true,
      reports: true,
      settings: true,
      users: true,
    };

    const result = await User.updateMany(
      {},
      {
        $set: {
          role: 'ADMIN',
          permissions,
        },
      }
    );

    console.log('Migração concluída com sucesso.');
    console.log(`Matched: ${result.matchedCount ?? result.n}`);
    console.log(`Modified: ${result.modifiedCount ?? result.nModified}`);

    process.exit(0);
  } catch (error) {
    console.error('Erro na migração:', error);
    process.exit(1);
  }
}

migrateUsersToAdmin();