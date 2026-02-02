// clearDatabase.js
const mongoose = require('mongoose');
require("dotenv").config()

const MONGO_URI = process.env.MONGODB_LOCAL_URI

async function clearDatabase() {
    try {
        await mongoose.connect(MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });

        console.log('Conectado ao banco!');

        const collections = await mongoose.connection.db.listCollections().toArray();

        for (const coll of collections) {
            console.log(`Limpando collection: ${coll.name}`);
            await mongoose.connection.db.collection(coll.name).deleteMany({});
        }

        console.log('Todas as collections foram limpas!');
        process.exit(0);
    } catch (err) {
        console.error('Erro ao limpar o banco:', err);
        process.exit(1);
    }
}

clearDatabase();
