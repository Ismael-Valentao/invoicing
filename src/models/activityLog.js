const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    userName: { type: String },
    action: {
        type: String,
        enum: ['created', 'updated', 'deleted', 'cancelled', 'paid', 'exported', 'duplicated', 'converted', 'login'],
        required: true
    },
    entity: {
        type: String,
        enum: ['invoice', 'quotation', 'vd', 'receipt', 'sale', 'product', 'client', 'supplier', 'expense', 'user', 'settings', 'subscription'],
        required: true
    },
    entityId: { type: mongoose.Schema.Types.ObjectId },
    description: { type: String, required: true },
    metadata: { type: mongoose.Schema.Types.Mixed },
}, { timestamps: true });

// Auto-delete logs older than 90 days
activityLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);