const mongoose = require('mongoose');

const errorLogSchema = new mongoose.Schema({
    message: { type: String, required: true },
    stack: { type: String },
    method: { type: String },
    url: { type: String },
    statusCode: { type: Number },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null },
    userAgent: { type: String },
    ip: { type: String },
}, { timestamps: true });

errorLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('ErrorLog', errorLogSchema);
