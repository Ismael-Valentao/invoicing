const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    type: {
        type: String,
        enum: ['stock_low', 'invoice_overdue', 'sale_created', 'expense_created', 'subscription_warning', 'client_debt', 'general'],
        default: 'general'
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    icon: { type: String, default: 'fas fa-bell' },
    color: { type: String, default: 'primary' },
    link: { type: String },
    read: { type: Boolean, default: false },
    metadata: { type: mongoose.Schema.Types.Mixed },
}, { timestamps: true });

// Auto-delete notifications older than 30 days
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

module.exports = mongoose.model('Notification', notificationSchema);