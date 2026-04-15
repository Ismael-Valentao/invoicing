const Company = require('../models/company');

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomCode(length = 8) {
    let code = '';
    for (let i = 0; i < length; i++) {
        code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    }
    return code;
}

async function generateUniqueReferralCode() {
    for (let i = 0; i < 12; i++) {
        const code = randomCode(8);
        const exists = await Company.findOne({ referralCode: code }).select('_id').lean();
        if (!exists) return code;
    }
    throw new Error('Não foi possível gerar código de indicação único.');
}

async function ensureCompanyReferralCode(companyId) {
    const company = await Company.findById(companyId).select('referralCode');
    if (!company) return null;
    if (company.referralCode) return company.referralCode;
    company.referralCode = await generateUniqueReferralCode();
    await company.save();
    return company.referralCode;
}

module.exports = { generateUniqueReferralCode, ensureCompanyReferralCode };
