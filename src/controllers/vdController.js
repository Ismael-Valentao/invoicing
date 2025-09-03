const Invoice = require("../models/vd");
const { generateVDPDF } = require("../utils/pdfGenerator");
const { amounts } = require("../utils/amountCalculator");

exports.createVD = async (req, res) => {
  const { subTotal, tax, totalAmount } = amounts(req.body.items, req.body.iva*1*0.1);
  const userId = req.user._id;
  const companyId = req.user.company._id;
  const vd = new Invoice({
    docType: "vd",
    companyName: req.body.companyName,
    clientName: req.body.clientName,
    clientNUIT: req.body.clientNUIT,
    invoiceNumber: req.body.invoiceNumber,
    date: req.body.date,
    items: req.body.items,
    appliedTax:req.body.iva*1*0.01,
    subTotal,
    tax,
    totalAmount,
    dueDate: req.body.dueDate || req.body.date,
    companyId,
    userId,
  });

  const existingVD = await Invoice.findOne({
    invoiceNumber: req.body.invoiceNumber,
    companyId,
  });
  if (existingVD) {
    return res.status(400).json({
      error: "VD já existe",
    });
  }

  await vd.save();
  res.status(201).json({
    success: true,
    vd,
  });
};

exports.getVDs = async (req, res) => {
  const companyId = req.user.company._id;
  const vds = await Invoice.find({
    docType: "vd",
    companyId,
  });
  if (!vds) {
    return res.status(404).json({
      error: "Nenhum VD encontrado",
    });
  }
  return res.json({
    success: true,
    vds,
  });
};

exports.getVDById = async (req, res) => {
  const companyId = req.user.company._id;
  const vd = await Invoice.findOne({
    _id: req.params.id,
    docType: "vd",
    companyId,
  });
  if (!vd) {
    return res.status(404).json({
      error: "VD não encontrado",
    });
  }
  return res.json({
    success: true,
    vd,
  });
};

exports.getVDLastNumber = async (req, res) => {
  const companyId = req.user.company._id;
  const lastVD = await Invoice.findOne({
    docType: "vd",
    companyId,
  }).sort({ createdAt: -1 });
  if (!lastVD) {
    return res.status(404).json({
      error: "Nenhum VD encontrado",
      length: 0,
      lastVDNumber: "0001",
    });
  }
  return res.json({
    success: true,
    lastVDNumber: lastVD.invoiceNumber,
  });
};

exports.getVDsTotalAmount = async (req, res) => {
  const companyId = req.user.company._id;
  const vds = await Invoice.find({
    docType: "vd",
    companyId,
  });
  if (!vds) {
    return res.status(404).json({
      error: "Nenhum VD encontrado",
    });
  }
  const totalAmount = vds.reduce((acc, vd) => acc + vd.totalAmount, 0);
  return res.json({
    success: true,
    totalAmount,
  });
}

exports.getVDAmountByMonth = async (req, res) => {
  const companyId = req.user.company._id;
  const month = req.params.month;
  const year = req.params.year;

  const vds = await Invoice.find({
    docType: "vd",
    companyId,
    date: {
      $gte: new Date(`${year}-${month}-01`),
      $lt: new Date(`${year}-${month + 1}-01`),
    },
  });

  if (!vds || vds.length === 0) {
    return res.status(404).json({
      error: "Nenhum VD encontrado para este mês",
    });
  }

  const totalAmount = vds.reduce((acc, vd) => acc + vd.totalAmount, 0);
  return res.json({
    success: true,
    totalAmount,
  });
};

exports.generateVDPDF = async (req, res) => {
  const companyId = req.user.company._id;
  const vd = await Invoice.findOne({
    _id: req.params.id,
    docType: "vd",
    companyId,
  });
  if (!vd) {
    return res.status(404).json({
      error: "VD não encontrado",
    });
  }
  try {
    const pdfBuffer = await generateVDPDF(req.user.company, vd);
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=vd-${vd.invoiceNumber}.pdf`,
    });
    res.send(pdfBuffer);
  } catch (error) {
    console.error("Erro ao gerar PDF:", error);
    res.status(500).json({
      error: "Erro ao gerar PDF",
    });
  }
};

