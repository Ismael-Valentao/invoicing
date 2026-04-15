const Client = require('../models/client');
const {
    MODEL_BY_TYPE,
    LABEL_BY_TYPE,
    getModel,
    ensureShareToken,
    findByToken,
    buildShareUrl,
    buildWhatsAppMessage,
    buildWhatsAppUrl
} = require('../utils/shareDocument');

async function resolveClientPhone(doc, companyId) {
    if (doc.clientPhone && doc.clientPhone.trim()) return doc.clientPhone.trim();
    try {
        if (doc.clientId) {
            const c = await Client.findOne({ _id: doc.clientId, companyId }).select('phone').lean();
            if (c?.phone) return c.phone;
        }
        if (doc.clientName) {
            const byName = await Client.findOne({
                companyId,
                name: new RegExp('^' + String(doc.clientName).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i')
            }).select('phone').lean();
            if (byName?.phone) return byName.phone;
        }
    } catch (e) { /* best-effort */ }
    return '';
}

/**
 * GET /api/share/:type/:id
 * Autenticado: devolve token (gerando se não existir) + link público + link WhatsApp.
 */
exports.getShareInfo = async (req, res) => {
    try {
        const { type, id } = req.params;
        const Model = getModel(type);
        if (!Model) return res.status(400).json({ success: false, message: 'Tipo de documento inválido.' });

        const companyId = req.user.company._id;
        const doc = await Model.findOne({ _id: id, companyId });
        if (!doc) return res.status(404).json({ success: false, message: 'Documento não encontrado.' });

        const token = await ensureShareToken(doc);
        const shareUrl = buildShareUrl(req, token);
        const message = buildWhatsAppMessage(type, doc, shareUrl);

        let phone = doc.clientPhone;
        if (!phone) {
            phone = await resolveClientPhone(doc, companyId);
            if (phone) {
                doc.clientPhone = phone;
                try { await doc.save(); } catch (e) { /* best-effort */ }
            }
        }

        const waUrl = buildWhatsAppUrl(phone, message);

        return res.json({
            success: true,
            type,
            shareUrl,
            message,
            whatsappUrl: waUrl,
            clientPhone: phone || '',
            clientName: doc.clientName || ''
        });
    } catch (err) {
        console.error('[getShareInfo]', err);
        return res.status(500).json({ success: false, message: 'Erro ao preparar partilha.' });
    }
};

/**
 * GET /share/:token  (pública)
 * Renderiza o portal público com os dados do documento.
 */
exports.renderPublicView = async (req, res) => {
    try {
        const token = (req.params.token || '').trim();
        const result = await findByToken(token);
        if (!result) return res.status(404).render('404', { title: '404', user: null, requestedUrl: req.originalUrl });

        const { type, doc } = result;
        const label = LABEL_BY_TYPE[type] || 'Documento';
        return res.render('public-share', {
            title: `${label.charAt(0).toUpperCase() + label.slice(1)} — ${doc.clientName}`,
            docType: type,
            docLabel: label,
            doc,
            shareToken: token
        });
    } catch (err) {
        console.error('[renderPublicView]', err);
        return res.status(500).send('Erro ao carregar documento.');
    }
};
