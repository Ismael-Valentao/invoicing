const Invoice = require('../models/invoice');
const {generateInvoicePDF} = require('../utils/pdfGenerator');
const { amounts } = require('../utils/amountCalculator');

exports.createInvoice = async (req, res) => {
    const { subTotal, tax, totalAmount } = amounts(req.body.items);
    const userId = req.user._id;
    const companyId = req.user.company._id;
    const invoice = new Invoice({
        companyName: req.body.companyName,
        clientName: req.body.clientName,
        clientNUIT: req.body.clientNUIT,
        invoiceNumber: req.body.invoiceNumber,
        date: req.body.date,
        items: req.body.items,
        subTotal,
        tax,
        totalAmount,
        dueDate: req.body.date,
        companyId,
        userId
    });

    const existingInvoice = await Invoice.findOne({ invoiceNumber: req.body.invoiceNumber, companyId });
    if (existingInvoice) {
        return res.status(400).json({ error: 'Fatura já existe' });
    }

    await invoice.save();
    res.status(201).json({ success: true, invoice });
};

exports.getInvoices = async (req, res) => {
    const companyId = req.user.company._id;
    const invoices = await Invoice.find({ companyId });
    if (!invoices) {
        return res.status(404).json({ error: 'Nenhuma fatura encontrada' });
    }
    return res.json({ status: 'success', invoices });
};

exports.getInvoiceById = async (req, res) => {
    const companyId = req.user.company._id;
    const invoice = await Invoice.findOne({ _id: req.params.id, companyId });
    if (!invoice) {
        return res.status(404).json({ error: 'Fatura não encontrada' });
    }
    return res.json({ status: 'success', invoice });
};

exports.getLastInvoice = async (req, res) => {
    const companyId = req.user.company._id;
    const lastInvoice = await Invoice.findOne({ companyId }).sort({ createdAt: -1 }).limit(1);
    
    return res.status(200).json({ success: true, lastInvoice: !lastInvoice ? '000' : lastInvoice.invoiceNumber });
}

exports.getInvoicesTotalAmount = async (req, res) => {
    const companyId = req.user.company._id;
    const invoices = await Invoice.find({ companyId: companyId });
    const total = invoices.reduce((acc, invoice) => acc + invoice.totalAmount, 0);

    const totalFacturado = invoices.length > 0 ? total : 0;
    res.status(200).json({ success: true, totalAmount: totalFacturado });

}

exports.getTotalInvoices = async (req, res) => {
    const companyId = req.user.company._id;
    const totalInvoices = await Invoice.countDocuments({ companyId });
    res.status(200).json({ success: true, totalInvoices });
}

exports.getPaidInvoices = async (req, res) => {
    const companyId = req.user.company._id;
    let paidInvoices = await Invoice.countDocuments({ companyId, status: 'paid' });
    paidInvoices = paidInvoices || 0; 
    return res.json({ status: 'success', paidInvoices });
}

exports.updateInvoiceStatus = async (req, res) => {
    const companyId = req.user.company._id;
    const invoice = await Invoice.findOne({ _id: req.params.id, companyId });
    if (!invoice) {
        return res.status(404).json({ error: 'Fatura não encontrada' });
    }

    invoice.status = req.body.status.toLowerCase();
    await invoice.save();
    return res.json({ success:true, invoiceStatus: invoice.status });
}

exports.getTotalAmountByMonth = async (req, res)=>{
    const companyId = req.user.company._id;
    const invoices = await Invoice.find({ companyId });
    const totalByMonth = invoices.reduce((acc, invoice) => {
        const month = new Date(invoice.date).getMonth() + 1;
        acc[month] = (acc[month] || 0) + invoice.totalAmount;
        return acc;
    }, {});

    const totalByMonthArray = Object.entries(totalByMonth).map(([month, total]) => ({ month, total }));

    return res.json({ status: 'success', totalByMonth: totalByMonthArray });
}

exports.downloadInvoicePDF = async (req, res) => {
    const companyInfo = req.user.company;
    const companyId = companyInfo._id;
    const invoice = await Invoice.findOne({ _id: req.params.id, companyId });

    if (!invoice) {
        return res.status(404).json({ error: 'Fatura não encontrada' });
    }

    try {
        const pdfBuffer = await generateInvoicePDF(companyInfo, invoice);
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename=factura-${invoice.invoiceNumber}.pdf`,
        });
        res.send(pdfBuffer);
    } catch (err) {
        console.error('Erro ao gerar PDF:', err);
        res.status(500).json({ error: 'Erro ao gerar o PDF da fatura' });
    }
};