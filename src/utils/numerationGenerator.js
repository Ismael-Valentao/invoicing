const Counter = require('../models/counter');

/**
 * Formato Opção C: SIGLA ANO_CURTO/NÚMERO (4 dígitos)
 * Exemplos: FT 26/0001, CT 26/0001, VD 26/0001, RC 26/0001, RV 26/0001
 *
 * O contador é por empresa + tipo + ano (reinicia a cada ano).
 */

const PREFIXES = {
    invoice:      'FT',
    quotation:    'CT',
    vd:           'VD',
    recibo:       'RC',
    saleReceipt:  'RV',
    credit_note:  'NC',
    debit_note:   'ND',
};

function buildNumber(prefix, year, seq) {
    const y = String(year).slice(-2);
    const n = String(seq).padStart(4, '0');
    return `${prefix} ${y}/${n}`;
}

async function getNextNumber(companyId, type, session = null) {
    const prefix = PREFIXES[type];
    if (!prefix) throw new Error(`Tipo de documento desconhecido: ${type}`);

    const year = new Date().getFullYear();
    const counterKey = `${type}_${year}`;

    const opts = { new: true, upsert: true };
    if (session) opts.session = session;

    const counter = await Counter.findOneAndUpdate(
        { companyId, type: counterKey },
        { $inc: { value: 1 } },
        opts
    );

    return buildNumber(prefix, year, counter.value);
}

// Convenience wrappers
async function getNextInvoiceNumber(companyId, session = null) {
    return getNextNumber(companyId, 'invoice', session);
}

async function getNextQuotationNumber(companyId, session = null) {
    return getNextNumber(companyId, 'quotation', session);
}

async function getNextVDNumber(companyId, session = null) {
    return getNextNumber(companyId, 'vd', session);
}

async function getNextReciboNumber(companyId, session = null) {
    return getNextNumber(companyId, 'recibo', session);
}

async function getNextReceiptNumber(companyId, session = null) {
    return getNextNumber(companyId, 'saleReceipt', session);
}

async function getNextCreditNoteNumber(companyId, session = null) {
    return getNextNumber(companyId, 'credit_note', session);
}

async function getNextDebitNoteNumber(companyId, session = null) {
    return getNextNumber(companyId, 'debit_note', session);
}

module.exports = {
    PREFIXES,
    buildNumber,
    getNextNumber,
    getNextInvoiceNumber,
    getNextQuotationNumber,
    getNextVDNumber,
    getNextReciboNumber,
    getNextReceiptNumber,
    getNextCreditNoteNumber,
    getNextDebitNoteNumber,
};
