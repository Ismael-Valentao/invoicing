const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String},
    phone: { type: String},
    address: { type: String},
    nuit: { type: String, required: true, default: 'N/A' },
    companyId: {type: mongoose.Schema.Types.ObjectId, ref: 'Company'},
    category: { type: String, enum: ['final', 'revendedor', 'grossista', 'vip', 'outro'], default: 'final' },
    priceMultiplier: { type: Number, default: 1 },
}, { timestamps: true });

module.exports = mongoose.model('Client', clientSchema);