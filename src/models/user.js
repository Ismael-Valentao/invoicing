const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    contact: { type: String },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
    status: {
        type: String,
        enum: ['active', 'blocked'],
        default: 'active',
        required: true
    }
}, {
    timestamps: true,
})

module.exports = mongoose.model('User', userSchema);