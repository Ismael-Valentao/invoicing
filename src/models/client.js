const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, unique: true },
    phone: { type: String},
    address: { type: String},
    nuit: { type: String, required: true },
    companyId: {type: mongoose.Schema.Types.ObjectId, ref: 'Company'}
});

module.exports = mongoose.model('Client', clientSchema);