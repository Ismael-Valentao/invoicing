const Recibo = require("../models/recibo");
const Invoice = require("../models/invoice");
const { generateReciboPDF } = require("../utils/pdfGenerator");
const { amounts } = require("../utils/amountCalculator");

exports.createRecibo = async (req, res) => {
  const { subTotal, tax, totalAmount } = amounts(req.body.items);
  const userId = req.user._id;
  const companyId = req.user.company._id;

  const existingRecibo = await Recibo.findOne({
    reciboNumber: req.body.reciboNumber,
    companyId,
  });

  if (existingRecibo) {
    return res.status(400).json({
      error: "Recibo já existe",
    });
  }

  const lastReciboNumber = await Recibo.findOne({
    companyId,
  }).sort({ createdAt: -1 });
  let newNumber = '0001';
  if (lastReciboNumber) {
    const lastNumber = parseInt(lastReciboNumber.reciboNumber);
    newNumber = (lastNumber + 1).toString().padStart(4, "0"); // Ensure 6 digits
  } else {
    newNumber = "0001"; // Start with 0001 if no previous recibos exist
  }

  const recibo = new Recibo({
    docType: "recibo",
    companyName: req.body.companyName,
    clientName: req.body.clientName,
    clientNUIT: req.body.clientNUIT,
    reciboNumber: newNumber,
    appliedTax:req.body.iva*1*0.01,
    date: req.body.date,
    items: req.body.items,
    subTotal,
    tax,
    totalAmount,
    dueDate: req.body.dueDate || req.body.date,
    companyId,
    userId,
  });

  await recibo.save();
  res.status(201).json({
    success: true,
    recibo,
  });
};

exports.getRecibos = async (req, res) => {
  const companyId = req.user.company._id;
  const recibos = await Recibo.find({
    companyId,
  });
  if (!recibos) {
    return res.status(404).json({
      error: "Nenhum recibo encontrado",
    });
  }
  return res.json({
    success: true,
    recibos,
  });
};

exports.getReciboById = async (req, res) => {
  const companyId = req.user.company._id;
  const recibo = await Recibo.findOne({
    _id: req.params.id,
    companyId,
  });
  if (!recibo) {
    return res.status(404).json({
      error: "Recibo não encontrado",
    });
  }
  return res.json({
    success: true,
    recibo,
  });
};

exports.generateReciboPDF = async (req, res) => {
  const companyId = req.user.company._id;
  const recibo = await Recibo.findOne({
    _id: req.params.id,
    companyId,
  });
  if (!recibo) {
    return res.status(404).json({
      error: "Recibo não encontrado",
    });
  }
  try {
    const pdfBuffer = await generateReciboPDF(req.user.company, recibo);
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=recibo-${recibo.reciboNumber}.pdf`,
    });
    res.send(pdfBuffer);
  } catch (error) {
    console.error("Erro ao gerar PDF:", error);
    res.status(500).json({
      error: "Erro ao gerar PDF",
    });
  }
};

exports.generateReciboFromInvoice = async (req, res) => {
  const companyId = req.user.company._id;
  const companyInfo = req.user.company;
  const invoice = await Invoice.findOne({
    _id: req.params.id,
    companyId,
    docType: "invoice",
  });

  if (!invoice) {
    return res.status(404).json({
      error: "Fatura não encontrada",
    });
  }

  const { subTotal, tax, totalAmount } = amounts(invoice.items);

  const recibo = new Recibo({
    docType: "recibo",
    companyName: invoice.companyName,
    clientName: invoice.clientName,
    clientNUIT: invoice.clientNUIT,
    reciboNumber: invoice.invoiceNumber,
    date: new Date(),
    items: invoice.items,
    subTotal,
    tax,
    totalAmount,
    dueDate: new Date(),
    companyId,
    userId: req.user._id,
  });

  await recibo.save();
  //download the recibo pdf
  try {
    const pdfBuffer = await generateReciboPDF(companyInfo, recibo);
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=recibo-${recibo.reciboNumber}.pdf`,
    });
    res.send(pdfBuffer);
  } catch (error) {
    console.error("Erro ao gerar PDF:", error);
    return res.status(500).json({
      error: "Erro ao gerar PDF",
    });
  }
};

exports.downloadReciboPDF = async (req, res) => {
  const companyId = req.user.company._id;
  const recibo = await Recibo.findOne({
    _id: req.params.id,
    companyId,
  });

  if (!recibo) {
    return res.status(404).json({
      error: "Recibo não encontrado",
    });
  }

  try {
    const pdfBuffer = await generateReciboPDF(req.user.company, recibo);
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=recibo-${recibo.reciboNumber}.pdf`,
    });
    res.send(pdfBuffer);
  } catch (error) {
    console.error("Erro ao gerar PDF:", error);
    res.status(500).json({
      error: "Erro ao gerar PDF",
    });
  }
};
