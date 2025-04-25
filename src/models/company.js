const mongoose = require('mongoose');

const companySchema = new mongoose.Schema({
    name: { type: String, required: true },
    address: { type: String, required: true },
    contact: { type: String, required: true },
    email: { type: String, required: true },
    nuit: { type: String, required: true },
    logoUrl: { type: String, required: true },
}, {
    timestamps: true,
})

module.exports = mongoose.model('Company', companySchema);