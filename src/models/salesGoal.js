const mongoose = require('mongoose');

const salesGoalSchema = new mongoose.Schema({
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    month: { type: Number, required: true },
    year: { type: Number, required: true },
    targetAmount: { type: Number, required: true },
}, { timestamps: true });

salesGoalSchema.index({ companyId: 1, month: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('SalesGoal', salesGoalSchema);
