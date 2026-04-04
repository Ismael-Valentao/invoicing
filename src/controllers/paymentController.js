const Payment = require('../models/payment');
const Invoice = require('../models/invoice');
const Recibo = require('../models/recibo');
const { getNextReciboNumber } = require('../utils/numerationGenerator');
const { generatePartialPaymentReceiptPDF } = require('../utils/pdfGenerator');
const { log: logActivity } = require('./activityLogController');

// Register a partial payment
exports.addPayment = async (req, res) => {
    try {
        const companyId = req.user.company._id;
        const { invoiceId, amount, paymentMethod, reference, notes, date } = req.body;

        if (!invoiceId || !amount || amount <= 0) {
            return res.status(400).json({ success: false, message: 'ID da factura e valor são obrigatórios.' });
        }

        const invoice = await Invoice.findOne({ _id: invoiceId, companyId, docType: 'invoice' });
        if (!invoice) return res.status(404).json({ success: false, message: 'Factura não encontrada.' });
        if (invoice.status === 'cancelled') return res.status(400).json({ success: false, message: 'Factura anulada.' });
        if (invoice.status === 'paid') return res.status(400).json({ success: false, message: 'Factura já totalmente paga.' });

        const remainingBefore = invoice.totalAmount - (invoice.paidAmount || 0);
        if (amount > remainingBefore + 0.01) {
            return res.status(400).json({ success: false, message: `Valor excede o saldo devedor (${remainingBefore.toFixed(2)} MZN).` });
        }

        // Generate receipt number for this payment
        const receiptNumber = await getNextReciboNumber(companyId);

        const payment = await Payment.create({
            companyId, invoiceId, userId: req.user._id,
            amount, paymentMethod, reference, notes,
            receiptNumber,
            date: date || new Date()
        });

        // Update invoice paid amount and status
        invoice.paidAmount = (invoice.paidAmount || 0) + amount;
        const remainingAfter = invoice.totalAmount - invoice.paidAmount;

        if (invoice.paidAmount >= invoice.totalAmount - 0.01) {
            invoice.status = 'paid';
            invoice.paidAmount = invoice.totalAmount;

            // Also generate a full Recibo for accounting
            try {
                const fullReciboNumber = await getNextReciboNumber(companyId);
                await Recibo.create({
                    docType: 'recibo', companyName: invoice.companyName,
                    clientName: invoice.clientName, clientNUIT: invoice.clientNUIT,
                    reciboNumber: fullReciboNumber, date: new Date(), items: invoice.items,
                    subTotal: invoice.subTotal, tax: invoice.tax,
                    totalAmount: invoice.totalAmount, dueDate: new Date(),
                    companyId, userId: req.user._id, invoiceId: invoice._id,
                });
            } catch (e) { /* best-effort */ }
        } else {
            invoice.status = 'partial';
        }
        await invoice.save();

        logActivity({
            companyId, userId: req.user._id, userName: req.user.name,
            action: 'paid', entity: 'invoice', entityId: invoice._id,
            description: `Registou pagamento de ${amount} MZN na factura ${invoice.invoiceNumber} (${receiptNumber}). Total pago: ${invoice.paidAmount}/${invoice.totalAmount} MZN.`
        });

        res.json({
            success: true,
            message: invoice.status === 'paid'
                ? `Factura ${invoice.invoiceNumber} totalmente paga.`
                : `Pagamento de ${amount} MZN registado. Faltam ${remainingAfter.toFixed(2)} MZN.`,
            payment,
            receiptNumber,
            invoiceStatus: invoice.status,
            paidAmount: invoice.paidAmount,
            remaining: Math.max(0, remainingAfter),
            downloadUrl: `/api/features/payments/${payment._id}/pdf`
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// Download partial payment receipt PDF
exports.downloadPaymentPDF = async (req, res) => {
    try {
        const payment = await Payment.findOne({ _id: req.params.id, companyId: req.user.company._id });
        if (!payment) return res.status(404).json({ success: false, message: 'Pagamento não encontrado.' });

        const invoice = await Invoice.findById(payment.invoiceId);
        if (!invoice) return res.status(404).json({ success: false, message: 'Factura não encontrada.' });

        // Calculate totals: sum of all payments up to and including this one
        const allPayments = await Payment.find({
            invoiceId: payment.invoiceId,
            companyId: req.user.company._id,
            date: { $lte: payment.date }
        }).sort({ date: 1 });

        const totalPaidSoFar = allPayments.reduce((sum, p) => sum + p.amount, 0);
        const remaining = Math.max(0, invoice.totalAmount - totalPaidSoFar);

        const companyInfo = req.user.company;

        const pdfBuffer = await generatePartialPaymentReceiptPDF(companyInfo, {
            receiptNumber: payment.receiptNumber,
            date: payment.date,
            invoice,
            payment,
            totalPaidSoFar,
            remaining
        });

        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename=recibo-${payment.receiptNumber}.pdf`,
        });
        res.send(pdfBuffer);
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// Get payments for an invoice
exports.getPayments = async (req, res) => {
    try {
        const payments = await Payment.find({
            invoiceId: req.params.invoiceId,
            companyId: req.user.company._id
        }).sort({ date: -1 });
        res.json({ success: true, payments });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
