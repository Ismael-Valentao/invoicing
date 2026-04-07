const mongoose = require('mongoose');

const loginAuditSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    email: { type: String },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null },
    ip: { type: String },
    userAgent: { type: String },
    success: { type: Boolean, default: true },
    reason: { type: String, default: '' }, // ex: "blocked", "wrong_password", "ok"
}, { timestamps: true });

loginAuditSchema.index({ createdAt: -1 });
loginAuditSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('LoginAudit', loginAuditSchema);
