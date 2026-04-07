const mongoose = require('mongoose');

/**
 * Configurações globais da plataforma. Documento único (singleton).
 */
const systemSettingSchema = new mongoose.Schema({
    maintenanceMode: { type: Boolean, default: false },
    maintenanceMessage: { type: String, default: 'Sistema em manutenção. Voltamos em breve.' },

    banner: {
        enabled: { type: Boolean, default: false },
        message: { type: String, default: '' },
        type: { type: String, enum: ['info', 'warning', 'success', 'danger'], default: 'info' },
        startsAt: { type: Date, default: null },
        endsAt: { type: Date, default: null },
    },
}, { timestamps: true });

systemSettingSchema.statics.getSingleton = async function () {
    let doc = await this.findOne();
    if (!doc) doc = await this.create({});
    return doc;
};

module.exports = mongoose.model('SystemSetting', systemSettingSchema);
