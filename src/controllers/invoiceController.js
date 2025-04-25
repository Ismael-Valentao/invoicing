const fs = require('fs');
const path = require('path');

const dataFile = path.join(__dirname, '../data/invoices.json');
const generateInvoicePDF = require('../utils/pdfGenerator');

function loadData() {
    if (!fs.existsSync(dataFile)) fs.writeFileSync(dataFile, '[]');
    const raw = fs.readFileSync(dataFile);
    return JSON.parse(raw);
}

function saveData(data) {
    fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
}

exports.createInvoice = (req, res) => {
    const invoices = loadData();
    const newInvoice = { id: Date.now().toString(), ...req.body };
    invoices.push(newInvoice);
    saveData(invoices);
    res.status(201).json({success:true, invoice: newInvoice});
};

exports.getInvoices = (req, res) => {
    const invoices = loadData();
    res.json(invoices);
};

exports.getInvoiceById = (req, res) => {
    const invoices = loadData();
    const invoice = invoices.find(inv => inv.id === req.params.id);
    if (!invoice) {
        return res.status(404).json({ error: 'Fatura não encontrada' });
    }
    res.json(invoice);
};

exports.downloadInvoicePDF = async (req, res) => {
    const invoices = loadData();
    const invoice = invoices.find(inv => inv.id === req.params.id);

    if (!invoice) {
        return res.status(404).json({ error: 'Fatura não encontrada' });
    }

    try {
        const pdfBuffer = await generateInvoicePDF(invoice);
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename=fatura-${invoice.id}.pdf`,
        });
        res.send(pdfBuffer);
    } catch (err) {
        console.error('Erro ao gerar PDF:', err);
        res.status(500).json({ error: 'Erro ao gerar o PDF da fatura' });
    }
};