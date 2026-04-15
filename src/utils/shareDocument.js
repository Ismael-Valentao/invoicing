const crypto = require('crypto');

const Invoice = require('../models/invoice');
const Quotation = require('../models/quotation');
const Recibo = require('../models/recibo');
const VD = require('../models/vd');

const MODEL_BY_TYPE = {
    invoice: Invoice,
    quotation: Quotation,
    recibo: Recibo,
    vd: VD
};

const LABEL_BY_TYPE = {
    invoice: 'factura',
    quotation: 'cotação',
    recibo: 'recibo',
    vd: 'venda a dinheiro'
};

const NUMBER_FIELD_BY_TYPE = {
    invoice: 'invoiceNumber',
    quotation: 'quotationNumber',
    recibo: 'reciboNumber',
    vd: 'invoiceNumber'
};

function generateToken(length = 24) {
    return crypto.randomBytes(length).toString('base64url').slice(0, length);
}

function getModel(type) {
    return MODEL_BY_TYPE[type] || null;
}

async function ensureShareToken(doc) {
    if (!doc) return null;
    if (doc.shareToken) return doc.shareToken;
    for (let i = 0; i < 5; i++) {
        const token = generateToken(24);
        try {
            doc.shareToken = token;
            await doc.save();
            return token;
        } catch (err) {
            if (err.code !== 11000) throw err;
        }
    }
    throw new Error('Não foi possível gerar token único de partilha.');
}

async function findByToken(token) {
    if (!token) return null;
    for (const [type, Model] of Object.entries(MODEL_BY_TYPE)) {
        const doc = await Model.findOne({ shareToken: token }).lean();
        if (doc) return { type, doc };
    }
    return null;
}

function normalizePhone(raw) {
    if (!raw) return '';
    const digits = String(raw).replace(/\D/g, '');
    if (!digits) return '';
    if (digits.startsWith('258') && digits.length >= 12) return digits;
    if (digits.length === 9) return '258' + digits;
    return digits;
}

function formatCurrency(value) {
    const n = Number(value || 0);
    return n.toLocaleString('pt-MZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function buildShareUrl(req, token) {
    const proto = req.protocol;
    const host = req.get('host');
    return `${proto}://${host}/share/${token}`;
}

function buildWhatsAppMessage(type, doc, shareUrl) {
    const label = LABEL_BY_TYPE[type] || 'documento';
    const numberField = NUMBER_FIELD_BY_TYPE[type];
    const number = doc[numberField] || '';
    const cliente = doc.clientName || 'Cliente';
    const empresa = doc.companyName || '';
    const total = formatCurrency(doc.totalAmount);

    return `Olá ${cliente},\n\nSegue a ${label} nº ${number} no valor de ${total} MZN emitida por ${empresa}.\n\nVer documento: ${shareUrl}\n\n— Emitido com Invoicing (invoicing.co.mz)`;
}

function buildWhatsAppUrl(phone, message) {
    const normalized = normalizePhone(phone);
    const encoded = encodeURIComponent(message);
    return normalized
        ? `https://wa.me/${normalized}?text=${encoded}`
        : `https://wa.me/?text=${encoded}`;
}

module.exports = {
    MODEL_BY_TYPE,
    LABEL_BY_TYPE,
    getModel,
    ensureShareToken,
    findByToken,
    normalizePhone,
    buildShareUrl,
    buildWhatsAppMessage,
    buildWhatsAppUrl
};
