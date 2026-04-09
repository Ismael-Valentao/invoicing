const mongoose = require('mongoose');

const releaseSchema = new mongoose.Schema({
    title: { type: String, required: true },
    version: { type: String, default: '' }, // ex: "v1.4.0"
    body: { type: String, required: true }, // markdown ou HTML
    type: { type: String, enum: ['feature', 'fix', 'improvement', 'announcement'], default: 'feature' },
    publishedAt: { type: Date, default: Date.now },
    authorName: { type: String, default: '' },
    pinned: { type: Boolean, default: false },
}, { timestamps: true });

releaseSchema.index({ publishedAt: -1 });

module.exports = mongoose.model('Release', releaseSchema);
