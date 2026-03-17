// clearCompanyData.js

const mongoose = require("mongoose");
require("dotenv").config();

const MONGO_URI = process.env.MONGODB_URI;

// ID da company que queres limpar
const COMPANY_ID = "69a9484d29219fe86199d7e8";

async function clearCompanyData() {
    try {
        await mongoose.connect(MONGO_URI);

        console.log("✅ Conectado ao banco");

        const companyObjectId = new mongoose.Types.ObjectId(COMPANY_ID);

        const collections = await mongoose.connection.db.listCollections().toArray();

        for (const coll of collections) {

            const collection = mongoose.connection.db.collection(coll.name);

            // tenta apagar documentos com company ou companyId
            const result = await collection.deleteMany({
                $or: [
                    { company: companyObjectId },
                    { companyId: companyObjectId }
                ]
            });

            if (result.deletedCount > 0) {
                console.log(`🧹 ${coll.name}: ${result.deletedCount} documentos apagados`);
            }
        }

        await mongoose.connection.db
            .collection("companies")
            .deleteOne({ _id: companyObjectId });

        console.log("🏁 Limpeza concluída");
        process.exit();

    } catch (err) {
        console.error("❌ Erro:", err);
        process.exit(1);
    }
}

clearCompanyData();