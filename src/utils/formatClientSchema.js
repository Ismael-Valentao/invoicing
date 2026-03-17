const { MongoClient } = require("mongodb");
require("dotenv").config();

async function updateValidator() {
  const client = new MongoClient(process.env.MONGODB_URI);

  try {
    await client.connect();

    const db = client.db("test");

    const result = await db.command({
      collMod: "clients",
      validator: {
        $jsonSchema: {
          bsonType: "object",
          required: ["name"],
          properties: {
            _id: { bsonType: "objectId" },
            __v: { bsonType: "int" },
            address: { bsonType: "string" },
            companyId: { bsonType: "objectId" },
            email: { bsonType: "string" },
            name: { bsonType: "string" },
            nuit: { bsonType: "string" },
            phone: { bsonType: "string" }
          }
        }
      },
      validationLevel: "moderate",
      validationAction: "error"
    });

    console.log("Validator atualizado com sucesso:", result);
  } catch (error) {
    console.error("Erro ao atualizar validator:", error);
  } finally {
    await client.close();
  }
}

updateValidator();