require('dotenv').config();
const mongoose = require('mongoose');

const Company = require('../models/company');
const Subscription = require('../models/subscription');

function getFreePlanExpiration() {
    const date = new Date();
    date.setMonth(date.getMonth() + 1);
    return date;
}

const mongodbURI = process.env.NODE_ENV.toLowerCase() === 'production' ? process.env.MONGODB_URI : process.env.MONGODB_LOCAL_URI;

(async () => {
    try {
        await mongoose.connect(mongodbURI);
        console.log('MongoDB connected');

        const companies = await Company.find({}, { _id: 1 });

        let created = 0;
        let skipped = 0;

        for (const company of companies) {
            const exists = await Subscription.findOne({ companyId: company._id });

            if (exists) {
                skipped++;
                continue;
            }

            await Subscription.create({
                companyId: company._id,
                plan: 'FREE',
                startDate: new Date(),
                expiresAt: getFreePlanExpiration(),
                status: 'active'
            });

            created++;
        }

        console.log(`✅ Subscriptions criadas: ${created}`);
        console.log(`⏭️ Já existentes: ${skipped}`);

        process.exit(0);

    } catch (err) {
        console.error('❌ Erro na migração:', err);
        process.exit(1);
    }
})();
