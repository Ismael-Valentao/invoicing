const Quotation = require('../models/quotation');
const { generateQuotationPDF } = require('../utils/pdfGenerator');
const { amounts, normalizeItems } = require('../utils/amountCalculator');

exports.createQuotation = async (req, res) => {
    const { subTotal, tax, totalAmount } = amounts(req.body.items, req.body.iva * 1 * 0.01);
    console.log(req.body.iva*1*0.1)
    const cleanedItems = normalizeItems(req.body.items);

    const userId = req.user._id;
    const companyId = req.user.company._id;
    const quotation = new Quotation({
        companyName: req.body.companyName,
        clientName: req.body.clientName,
        clientNUIT: req.body.clientNUIT || 'N/A',
        quotationNumber: req.body.quotationNumber,
        date: req.body.date,
        items: cleanedItems,
        appliedTax: req.body.iva * 1 * 0.01,
        subTotal,
        tax,
        totalAmount,
        dueDate: req.body.date,
        companyId,
        userId
    });

    await quotation.save();
    res.status(201).json({ status: "success", Quotation });
};

exports.getQuotations = async (req, res) => {
    const companyId = req.user.company._id;
    const quotations = await Quotation.find({ companyId });
    if (!quotations) {
        return res.status(404).json({ error: 'Nenhuma fatura encontrada' });
    }
    return res.json({ status: 'success', quotations });
};

exports.getQuotationById = async (req, res) => {
    const companyId = req.user.company._id;
    const quotation = await Quotation.findOne({ _id: req.params.id, companyId });
    if (!Quotation) {
        return res.status(404).json({ error: 'Fatura não encontrada' });
    }
    return res.json({ status: 'success', quotation });
};

exports.getLastQuotation = async (req, res) => {
    const companyId = req.user.company._id;
    const lastQuotation = await Quotation.findOne({ companyId }).sort({ createdAt: -1 }).limit(1);

    return res.status(200).json({ success: true, lastQuotation: !lastQuotation ? '000' : lastQuotation.quotationNumber });
}

exports.getQuotationsTotalAmount = async (req, res) => {
    const companyId = req.user.company._id;
    const quotations = await Quotation.find({ companyId: companyId });
    const total = quotations.reduce((acc, Quotation) => acc + Quotation.totalAmount, 0);

    const totalCotado = Quotations.length > 0 ? total : 0;
    res.status(200).json({ success: true, totalAmount: totalCotado });

}

exports.getTotalQuotations = async (req, res) => {
    const companyId = req.user.company._id;
    const totalQuotations = await Quotation.countDocuments({ companyId });
    res.status(200).json({ success: true, totalQuotations });
}

exports.downloadQuotationPDF = async (req, res) => {
    const companyInfo = req.user.company;
    const companyId = companyInfo._id;
    const quotation = await Quotation.findOne({ _id: req.params.id, companyId });

    if (!quotation) {
        return res.status(404).json({ error: 'Fatura não encontrada' });
    }

    try {
        const pdfBuffer = await generateQuotationPDF(companyInfo, quotation);
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename=cotacao-${quotation.quotationNumber}.pdf`,
        });
        res.send(pdfBuffer);
    } catch (err) {
        console.error('Erro ao gerar PDF:', err);
        res.status(500).json({ error: 'Erro ao gerar o PDF da fatura' });
    }
};