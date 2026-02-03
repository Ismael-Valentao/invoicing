const ExcelJS = require("exceljs");
const mongoose = require("mongoose")
const Invoice = require("../models/invoice");
const Recibo = require("../models/recibo");
const { generateInvoicePDF } = require("../utils/pdfGenerator");
const { amounts, normalizeItems } = require("../utils/amountCalculator");
const { normalizeInvoiceStatus } = require("../utils/normalizeStatus")
const { buildInvoiceFilter } = require("../utils/invoiceFilter");
const { generateStatementFileName} = require("../utils/extratoNameGenerator")

exports.createInvoice = async (req, res) => {
  const { subTotal, tax, totalAmount } = amounts(req.body.items, req.body.iva * 1 * 0.01);

  const cleanedItems = normalizeItems(req.body.items);

  const userId = req.user._id;
  const companyId = req.user.company._id;
  const invoice = new Invoice({
    docType: "invoice",
    companyName: req.body.companyName,
    clientName: req.body.clientName,
    clientNUIT: req.body.clientNUIT || 'N/A',
    invoiceNumber: req.body.invoiceNumber,
    date: req.body.date,
    items: cleanedItems,
    appliedTax: req.body.iva * 1 * 0.01,
    subTotal,
    tax,
    totalAmount,
    dueDate: req.body.date,
    companyId,
    userId,
    clientId:req.body.clientId
  });

  const existingInvoice = await Invoice.findOne({
    invoiceNumber: req.body.invoiceNumber,
    companyId,
  });
  if (existingInvoice) {
    return res.status(400).json({
      error: "Factura já existe",
    });
  }

  await invoice.save();
  res.status(201).json({
    success: true,
    invoice,
  });
};

exports.getInvoices = async (req, res) => {
  const companyId = req.user.company._id;
  const invoices = await Invoice.find({
    companyId,
  });
  if (!invoices) {
    return res.status(404).json({
      error: "Nenhuma fatura encontrada",
    });
  }
  return res.json({
    status: "success",
    invoices,
  });
};

exports.getInvoiceById = async (req, res) => {
  const companyId = req.user.company._id;
  const invoice = await Invoice.findOne({
    _id: req.params.id,
    companyId,
  });
  if (!invoice) {
    return res.status(404).json({
      error: "Fatura não encontrada",
    });
  }
  return res.json({
    status: "success",
    invoice,
  });
};

exports.getLastInvoice = async (req, res) => {
  const companyId = req.user.company._id;
  const lastInvoice = await Invoice.findOne({
    companyId,
  })
    .sort({
      createdAt: -1,
    })
    .limit(1);

  return res.status(200).json({
    success: true,
    lastInvoice: !lastInvoice ? "000" : lastInvoice.invoiceNumber,
  });
};

exports.getInvoicesTotalAmount = async (req, res) => {
  const companyId = req.user.company._id;
  const invoices = await Invoice.find({
    companyId: companyId,
  });
  const total = invoices.reduce((acc, invoice) => acc + invoice.totalAmount, 0);

  const totalFacturado = invoices.length > 0 ? total : 0;
  res.status(200).json({
    success: true,
    totalAmount: totalFacturado,
  });
};

exports.getTotalInvoices = async (req, res) => {
  const companyId = req.user.company._id;
  const totalInvoices = await Invoice.countDocuments({
    companyId,
  });
  res.status(200).json({
    success: true,
    totalInvoices,
  });
};

exports.getPaidInvoices = async (req, res) => {
  const companyId = req.user.company._id;
  let paidInvoices = await Invoice.countDocuments({
    companyId,
    status: "paid",
  });
  paidInvoices = paidInvoices || 0;
  return res.json({
    status: "success",
    paidInvoices,
  });
};

exports.updateInvoiceStatus = async (req, res) => {
  const companyId = req.user.company._id;
  const invoice = await Invoice.findOne({
    _id: req.params.id,
    companyId,
  });
  if (!invoice) {
    return res.status(404).json({
      error: "Fatura não encontrada",
    });
  }

  invoice.status = req.body.status.toLowerCase();
  await invoice.save();

  if (invoice.status === "paid") {
    const lastReciboNumber = await Recibo.findOne({
      companyId,
    }).sort({ createdAt: -1 });
    let newNumber = "0001";
    if (lastReciboNumber) {
      const lastNumber = parseInt(lastReciboNumber.reciboNumber);
      newNumber = (lastNumber + 1).toString().padStart(4, "0"); // Ensure 6 digits
    } else {
      newNumber = "0001"; // Start with 0001 if no previous recibos exist
    }

    const recibo = new Recibo({
      docType: "recibo",
      companyName: invoice.companyName,
      clientName: invoice.clientName,
      clientNUIT: invoice.clientNUIT,
      reciboNumber: newNumber,
      date: new Date(),
      items: invoice.items,
      subTotal: invoice.subTotal,
      tax: invoice.tax,
      totalAmount: invoice.totalAmount,
      dueDate: invoice.dueDate,
      companyId: companyId,
      userId: req.user._id,
    });

    await recibo.save();
  }

  return res.json({
    success: true,
    invoiceStatus: invoice.status,
  });
};

exports.getTotalAmountByMonth = async (req, res) => {
  const companyId = req.user.company._id;
  const invoices = await Invoice.find({
    companyId,
  });
  const totalByMonth = invoices.reduce((acc, invoice) => {
    const month = new Date(invoice.date).getMonth() + 1;
    acc[month] = (acc[month] || 0) + invoice.totalAmount;
    return acc;
  }, {});

  const totalByMonthArray = Object.entries(totalByMonth).map(
    ([month, total]) => ({
      month,
      total,
    })
  );

  return res.json({
    status: "success",
    totalByMonth: totalByMonthArray,
  });
};

exports.downloadInvoicePDF = async (req, res) => {
  const companyInfo = req.user.company;
  const companyId = companyInfo._id;
  const invoice = await Invoice.findOne({
    _id: req.params.id,
    companyId,
  });

  if (!invoice) {
    return res.status(404).json({
      error: "Fatura não encontrada",
    });
  }

  try {
    const pdfBuffer = await generateInvoicePDF(companyInfo, invoice);
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=factura-${invoice.invoiceNumber}.pdf`,
    });
    res.send(pdfBuffer);
  } catch (err) {
    console.error("Erro ao gerar PDF:", err);
    res.status(500).json({
      error: "Erro ao gerar o PDF da fatura",
    });
  }
};


exports.downloadInvoicesStatementExcel = async (req, res) => {
  try {
    const companyId = req.user.company._id;
    const { filter: useFilter } = req.params;
    const { client, status, startDate, endDate } = req.query;

    const query = { companyId };

    if (useFilter === "true") {
      if (client && mongoose.Types.ObjectId.isValid(client)) query.clientId = client;
      if (status && status !== "all") query.status = status;
      if (startDate && endDate) {
        query.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
      }
    }

    const invoices = await Invoice.find(query)
      .populate("clientId", "name nuit")
      .sort({ date: -1 })
      .lean();

    if (!invoices.length) {
      return res.status(404).json({ error: "Nenhuma fatura encontrada" });
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Extrato de Facturas");

    // Cabeçalhos
    worksheet.columns = [
      { header: "Nº Factura", key: "invoiceNumber", width: 18 },
      { header: "Cliente", key: "clientName", width: 30 },
      { header: "NUIT", key: "clientNUIT", width: 18 },
      { header: "Data", key: "date", width: 15 },
      { header: "Vencimento", key: "dueDate", width: 15 },
      { header: "Subtotal", key: "subTotal", width: 15 },
      { header: "IVA", key: "tax", width: 15 },
      { header: "Total", key: "totalAmount", width: 18 },
      { header: "Estado", key: "status", width: 15 },
    ];

    // Estilo do cabeçalho
    worksheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    worksheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF4E73DF" }, // azul escuro
    };
    worksheet.getRow(1).alignment = { horizontal: "center", vertical: "middle" };

    // Linha de dados
    invoices.forEach((invoice) => {
      const row = worksheet.addRow({
        invoiceNumber: invoice.invoiceNumber,
        clientName: invoice.client?.name || invoice.clientName || "",
        clientNUIT: invoice.client?.nuit || invoice.clientNUIT || "",
        date: invoice.date ? invoice.date.toISOString().split("T")[0] : "",
        dueDate: invoice.dueDate ? invoice.dueDate.toISOString().split("T")[0] : "",
        subTotal: invoice.subTotal,
        tax: invoice.tax,
        totalAmount: invoice.totalAmount,
        status: normalizeInvoiceStatus(invoice.status),
      });

      // Alinhamento e bordas para dados
      row.eachCell((cell) => {
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      });

      // Formatação monetária
      row.getCell("subTotal").numFmt = '#,##0.00 "MT"';
      row.getCell("tax").numFmt = '#,##0.00 "MT"';
      row.getCell("totalAmount").numFmt = '#,##0.00 "MT"';
    });

    // Total no fim
    const totalAmount = invoices.reduce((acc, inv) => acc + inv.totalAmount, 0);
    const totalRow = worksheet.addRow({
      clientName: "TOTAL",
      totalAmount,
    });

    totalRow.font = { bold: true };
    totalRow.eachCell((cell, colNumber) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFEAEAEA" }, // cinza claro
      };
      cell.alignment = { horizontal: colNumber === 2 ? "left" : "center" };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
      if (colNumber >= 6 && colNumber <= 8) {
        cell.numFmt = '#,##0.00 "MT"';
      }
    });

    const filename = generateStatementFileName(
      client === "all" || client === "" ? null : client,
      startDate,
      endDate
    );

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename=${filename}`);

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error("Erro ao gerar Excel:", error);
    res.status(500).json({ error: "Erro ao gerar extrato de facturas" });
  }
};


exports.getInvoicesPreview = async (req, res) => {
  try {
    const companyId = req.user.company._id;
    const filter = buildInvoiceFilter(companyId, req.query);

    const invoices = await Invoice.find(filter)
      .populate("clientId", "name nuit")
      .sort({ date: -1 })
      .limit(50) // preview limitado para performance
      .lean();

    const simplifiedInvoices = invoices.map(inv => ({
      _id: inv._id,
      invoiceNumber: inv.invoiceNumber,
      subTotal:inv.subTotal,
      tax:inv.tax,
      clientName: inv.client?.name || inv.clientName,
      date: inv.date ? inv.date.toISOString().split("T")[0] : "",
      totalAmount: inv.totalAmount,
      status: inv.status,
    }));

    res.json({ invoices: simplifiedInvoices });

  } catch (error) {
    console.error("Erro no preview de invoices:", error);
    res.status(500).json({ error: "Erro ao gerar preview de facturas" });
  }
};

exports.getInvoicesSummary = async (req, res) => {
  try {
    const companyId = req.user.company._id;
    const filter = buildInvoiceFilter(companyId, req.query);

    const invoices = await Invoice.find(filter).lean();

    const totalInvoices = invoices.length;
    const totalAmount = invoices.reduce((acc, inv) => acc + inv.totalAmount, 0);
    const paidAmount = invoices
      .filter(inv => inv.status === "paid")
      .reduce((acc, inv) => acc + inv.totalAmount, 0);
    const unpaidAmount = totalAmount - paidAmount;

    res.json({ totalInvoices, totalAmount, paidAmount, unpaidAmount });

  } catch (error) {
    console.error("Erro no resumo de invoices:", error);
    res.status(500).json({ error: "Erro ao gerar resumo de facturas" });
  }
};