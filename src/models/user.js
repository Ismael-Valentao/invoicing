const mongoose = require('mongoose');

const permissionsSchema = new mongoose.Schema({
    dashboard: { type: Boolean, default: false },
    sales: { type: Boolean, default: false },
    stock: { type: Boolean, default: false },
    invoicing: { type: Boolean, default: false },
    products: { type: Boolean, default: false },
    customers: { type: Boolean, default: false },
    suppliers: { type: Boolean, default: false },
    reports: { type: Boolean, default: false },
    settings: { type: Boolean, default: false },
    users: { type: Boolean, default: false }
}, { _id: false });

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    contact: { type: String },

    companyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
        required: false,
        default: null
    },

    role: {
        type: String,
        enum: ['SUPERADMIN', 'ADMIN', 'USER'],
        default: 'USER',
        required: true
    },

    permissions: {
        type: permissionsSchema,
        default: () => ({})
    },

    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },

    mustChangePassword: {
        type: Boolean,
        default: false
    },

    emailVerified: {
        type: Boolean,
        default: false
    },

    emailVerificationToken: {
        type: String
    },

    emailVerificationExpires: {
        type: Date
    },

    passwordResetToken: {
        type: String
    },

    passwordResetExpires: {
        type: Date
    },

    status: {
        type: String,
        enum: ['active', 'blocked'],
        default: 'active',
        required: true
    }
}, {
    timestamps: true,
});

module.exports = mongoose.model('User', userSchema);