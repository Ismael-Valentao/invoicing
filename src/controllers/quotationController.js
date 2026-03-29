const Quotation = require('../models/quotation');
const Invoice = require('../models/invoice');
const { generateQuotationPDF } = require('../utils/pdfGenerator');
const { amounts, normalizeItems } = require('../utils/amountCalculator');
const { log: logActivity } = require('./activityLogController');
const { getNextInvoiceNumber } = require('../utils/numerationGenerator');

exports.createQuotation = async (req, res) => {
    try {
        const { subTotal, tax, totalAmount } = amounts(
            req.body.items,
            req.body.iva * 1 * 0.01
        );

        const cleanedItems = normalizeItems(req.body.items);

        const userId = req.user._id;
        const companyId = req.user.company._id;

        const existingQuotation = await Quotation.findOne({
            quotationNumber: req.body.quotationNumber,
            companyId,
        });

        if (existingQuotation) {
            return res.status(400).json({
                success: false,
                message: 'Cotação já existe',
            });
        }

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

        logActivity({
            companyId: req.user.company._id, userId: req.user._id, userName: req.user.name,
            action: 'created', entity: 'quotation', entityId: quotation._id,
            description: `Criou cotação ${quotation.quotationNumber} para ${quotation.clientName}.`
        });

        return res.status(201).json({
            success: true,
            message: 'Cotação criada com sucesso.',
            quotation,
            downloadUrl: `/api/quotations/${quotation._id}/pdf`
        });
    } catch (error) {
        console.error('Erro ao criar cotação:', error);
        return res.status(500).json({
            success: false,
            message: 'Erro ao criar cotação.'
        });
    }
};

exports.getQuotations = async (req, res) => {
    try {
        const companyId = req.user.company._id;
        const quotations = await Quotation.find({ companyId });

        return res.json({
            success: true,
            quotations
        });
    } catch (error) {
        console.error('Erro ao obter cotações:', error);
        return res.status(500).json({
            success: false,
            message: 'Erro ao obter cotações.'
        });
    }
};

exports.getQuotationById = async (req, res) => {
    try {
        const companyId = req.user.company._id;
        const quotation = await Quotation.findOne({
            _id: req.params.id,
            companyId
        });

        if (!quotation) {
            return res.status(404).json({
                success: false,
                message: 'Cotação não encontrada'
            });
        }

        return res.json({
            success: true,
            quotation
        });
    } catch (error) {
        console.error('Erro ao obter cotação:', error);
        return res.status(500).json({
            success: false,
            message: 'Erro ao obter cotação.'
        });
    }
};

exports.getLastQuotation = async (req, res) => {
    try {
        const companyId = req.user.company._id;
        const lastQuotation = await Quotation.findOne({ companyId })
            .sort({ createdAt: -1 })
            .limit(1);

        return res.status(200).json({
            success: true,
            lastQuotation: !lastQuotation ? '000' : lastQuotation.quotationNumber
        });
    } catch (error) {
        console.error('Erro ao obter última cotação:', error);
        return res.status(500).json({
            success: false,
            message: 'Erro ao obter última cotação.'
        });
    }
};

exports.getQuotationsTotalAmount = async (req, res) => {
    try {
        const companyId = req.user.company._id;
        const quotations = await Quotation.find({ companyId });

        const total = quotations.reduce((acc, quotation) => acc + quotation.totalAmount, 0);
        const totalCotado = quotations.length > 0 ? total : 0;

        return res.status(200).json({
            success: true,
            totalAmount: totalCotado
        });
    } catch (error) {
        console.error('Erro ao obter total das cotações:', error);
        return res.status(500).json({
            success: false,
            message: 'Erro ao obter total das cotações.'
        });
    }
};

exports.getTotalQuotations = async (req, res) => {
    try {
        const companyId = req.user.company._id;
        const totalQuotations = await Quotation.countDocuments({ companyId });

        return res.status(200).json({
            success: true,
            totalQuotations
        });
    } catch (error) {
        console.error('Erro ao contar cotações:', error);
        return res.status(500).json({
            success: false,
            message: 'Erro ao contar cotações.'
        });
    }
};

exports.downloadQuotationPDF = async (req, res) => {
    try {
        const companyInfo = req.user.company;
        const companyId = companyInfo._id;

        const quotation = await Quotation.findOne({
            _id: req.params.id,
            companyId
        });

        if (!quotation) {
            return res.status(404).json({
                success: false,
                message: 'Cotação não encontrada'
            });
        }

        const pdfBuffer = await generateQuotationPDF(companyInfo, quotation);

        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename=cotacao-${quotation.quotationNumber}.pdf`,
        });

        return res.send(pdfBuffer);
    } catch (err) {
        console.error('Erro ao gerar PDF:', err);
        return res.status(500).json({
            success: false,
            message: 'Erro ao gerar o PDF da cotação'
        });
    }
};

exports.approveQuotation = async (req, res) => {
    try {
        const companyId = req.user.company._id;
        const userId = req.user._id;

        const quotation = await Quotation.findOne({
            _id: req.params.id,
            companyId
        });

        if (!quotation) {
            return res.status(404).json({
                success: false,
                message: 'Cotação não encontrada'
            });
        }

        if (quotation.invoiceId) {
            return res.status(400).json({
                success: false,
                message: 'Esta cotação já foi convertida em factura.'
            });
        }

        const nextInvoiceNumber = await getNextInvoiceNumber(companyId);

        const invoice = new Invoice({
            docType: "invoice",
            companyName: quotation.companyName,
            clientName: quotation.clientName,
            clientNUIT: quotation.clientNUIT || 'N/A',
            invoiceNumber: nextInvoiceNumber,
            date: new Date(),
            items: quotation.items,
            appliedTax: quotation.appliedTax,
            subTotal: quotation.subTotal,
            tax: quotation.tax,
            totalAmount: quotation.totalAmount,
            dueDate: new Date(),
            companyId,
            userId
        });

        await invoice.save();

        quotation.status = "approved";
        quotation.invoiceId = invoice._id;
        await quotation.save();

        return res.json({
            success: true,
            message: 'Cotação aprovada e convertida em factura com sucesso.',
            quotationStatus: quotation.status,
            invoice: {
                _id: invoice._id,
                invoiceNumber: invoice.invoiceNumber,
                pdfUrl: `/api/invoices/${invoice._id}/pdf`
            }
        });
    } catch (error) {
        console.error('Erro ao aprovar cotação:', error);
        return res.status(500).json({
            success: false,
            message: 'Erro ao aprovar cotação.'
        });
    }
};