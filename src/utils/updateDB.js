require('dotenv').config();
const mongoose = require('mongoose');

// ⚠️ Ajusta o caminho do teu model
const User = require('../models/user');

async function run() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);

        console.log('✅ Conectado ao MongoDB');

        const result = await User.updateMany(
            {
                $or: [
                    { emailVerified: { $exists: false } },
                    { emailVerified: false }
                ]
            },
            {
                $set: { emailVerified: true }
            }
        );

        console.log(`🎉 Contas atualizadas: ${result.modifiedCount}`);

        process.exit(0);
    } catch (err) {
        console.error('❌ Erro ao atualizar usuários:', err);
        process.exit(1);
    }
}

run();
