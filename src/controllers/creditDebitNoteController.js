const Invoice = require('../models/invoice');
const { getNextCreditNoteNumber, getNextDebitNoteNumber } = require('../utils/numerationGenerator');
const { log: logActivity } = require('./activityLogController');

/**
 * Nota de Crédito — anula total ou parcialmente uma factura.
 * A factura original muda para estado 'cancelled'.
 */
exports.createCreditNote = async (req, res) => {
    try {
        const companyId = req.user.company._id;
        const { invoiceId, reason, items } = req.body;

        if (!invoiceId) {
            return res.status(400).json({ success: false, message: 'ID da factura é obrigatório.' });
        }
        if (!reason) {
            return res.status(400).json({ success: false, message: 'Motivo da anulação é obrigatório.' });
        }

        const invoice = await Invoice.findOne({ _id: invoiceId, companyId, docType: 'invoice' });
        if (!invoice) {
            return res.status(404).json({ success: false, message: 'Factura não encontrada.' });
        }
        if (invoice.status === 'cancelled') {
            return res.status(400).json({ success: false, message: 'Esta factura já foi anulada.' });
        }

        // Check if a credit note already exists for this invoice
        const existingNC = await Invoice.findOne({ relatedInvoiceId: invoiceId, docType: 'credit_note', companyId });
        if (existingNC) {
            return res.status(400).json({ success: false, message: `Já existe uma Nota de Crédito (${existingNC.invoiceNumber}) para esta factura.` });
        }

        // Use invoice items if none provided (full cancellation)
        const noteItems = items && items.length > 0 ? items : invoice.items;

        // Calculate totals
        const subTotal = noteItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
        const tax = subTotal * (invoice.appliedTax || 0.16);
        const totalAmount = subTotal + tax;

        const noteNumber = await getNextCreditNoteNumber(companyId);

        const creditNote = await Invoice.create({
            docType: 'credit_note',
            companyId,
            userId: req.user._id,
            clientId: invoice.clientId,
            companyName: invoice.companyName,
            clientName: invoice.clientName,
            clientNUIT: invoice.clientNUIT,
            invoiceNumber: noteNumber,
            date: new Date(),
            items: noteItems,
            appliedTax: invoice.appliedTax,
            subTotal,
            tax,
            totalAmount,
            status: 'paid',
            relatedInvoiceId: invoice._id,
            reason,
            showBankDetails: false,
            showNotes: true,
        });

        // Mark original invoice as cancelled
        invoice.status = 'cancelled';
        await invoice.save();

        logActivity({
            companyId, userId: req.user._id, userName: req.user.name,
            action: 'created', entity: 'invoice', entityId: creditNote._id,
            description: `Emitiu Nota de Crédito ${noteNumber} referente à factura ${invoice.invoiceNumber}. Motivo: ${reason}`
        });

        res.json({
            success: true,
            message: `Nota de Crédito ${noteNumber} emitida. Factura ${invoice.invoiceNumber} anulada.`,
            creditNote,
            downloadUrl: `/api/invoices/${creditNote._id}/pdf`
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * Nota de Débito — acrescenta valor a uma factura existente.
 */
exports.createDebitNote = async (req, res) => {
    try {
        const companyId = req.user.company._id;
        const { invoiceId, reason, items } = req.body;

        if (!invoiceId) {
            return res.status(400).json({ success: false, message: 'ID da factura é obrigatório.' });
        }
        if (!reason) {
            return res.status(400).json({ success: false, message: 'Motivo é obrigatório.' });
        }
        if (!items || !items.length) {
            return res.status(400).json({ success: false, message: 'Itens são obrigatórios para Nota de Débito.' });
        }

        const invoice = await Invoice.findOne({ _id: invoiceId, companyId, docType: 'invoice' });
        if (!invoice) {
            return res.status(404).json({ success: false, message: 'Factura não encontrada.' });
        }
        if (invoice.status === 'cancelled') {
            return res.status(400).json({ success: false, message: 'Não é possível debitar uma factura anulada.' });
        }

        const subTotal = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
        const tax = subTotal * (invoice.appliedTax || 0.16);
        const totalAmount = subTotal + tax;

        const noteNumber = await getNextDebitNoteNumber(companyId);

        const debitNote = await Invoice.create({
            docType: 'debit_note',
            companyId,
            userId: req.user._id,
            clientId: invoice.clientId,
            companyName: invoice.companyName,
            clientName: invoice.clientName,
            clientNUIT: invoice.clientNUIT,
            invoiceNumber: noteNumber,
            date: new Date(),
            items,
            appliedTax: invoice.appliedTax,
            subTotal,
            tax,
            totalAmount,
            status: 'unpaid',
            relatedInvoiceId: invoice._id,
            reason,
            showBankDetails: invoice.showBankDetails,
            showNotes: true,
        });

        logActivity({
            companyId, userId: req.user._id, userName: req.user.name,
            action: 'created', entity: 'invoice', entityId: debitNote._id,
            description: `Emitiu Nota de Débito ${noteNumber} referente à factura ${invoice.invoiceNumber}. Motivo: ${reason}`
        });

        res.json({
            success: true,
            message: `Nota de Débito ${noteNumber} emitida referente à factura ${invoice.invoiceNumber}.`,
            debitNote,
            downloadUrl: `/api/invoices/${debitNote._id}/pdf`
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * Listar notas de crédito e débito de uma empresa.
 */
exports.getNotes = async (req, res) => {
    try {
        const { type } = req.query; // 'credit_note', 'debit_note', or empty for both
        const filter = { companyId: req.user.company._id };
        if (type) {
            filter.docType = type;
        } else {
            filter.docType = { $in: ['credit_note', 'debit_note'] };
        }
        const notes = await Invoice.find(filter)
            .sort({ createdAt: -1 })
            .populate('relatedInvoiceId', 'invoiceNumber');
        res.json({ success: true, notes });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
