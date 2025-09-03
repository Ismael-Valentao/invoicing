const mongoose = require('mongoose');

const bankDetailsSchema = new mongoose.Schema({
    bank: { type: String },           
    account_name: { type: String },
    nib: { type: String },
    nuib: { type: String },          
    account_number: { type: String }
}, { _id: false });

const companySchema = new mongoose.Schema({
    name: { type: String, required: true },
    address: { type: String, required: true },
    contact: { type: String, required: true },
    email: { type: String, required: true },
    nuit: { type: String, required: true },
    logoUrl: { type: String },
    bankDetails: bankDetailsSchema
}, {
    timestamps: true,
});

module.exports = mongoose.model('Company', companySchema);
