const ExcelJS = require("exceljs");
const mongoose = require("mongoose")
const Invoice = require("../models/invoice");
const Recibo = require("../models/recibo");
const Product = require("../models/product");
const { processSale } = require("../services/sale");
const { generateInvoicePDF, generateCreditNotePDF, generateDebitNotePDF } = require("../utils/pdfGenerator");
const { amounts, normalizeItems } = require("../utils/amountCalculator");
const { normalizeInvoiceStatus } = require("../utils/normalizeStatus")
const { buildInvoiceFilter } = require("../utils/invoiceFilter");
const { generateStatementFileName } = require("../utils/extratoNameGenerator")
const { log: logActivity } = require('./activityLogController');
const { getNextReciboNumber, getNextInvoiceNumber } = require('../utils/numerationGenerator');

exports.createInvoice = async (req, res) => {
  try {
  const userId = req.user._id;
  const companyId = req.user.company._id;

  let cleanedItems = normalizeItems(req.body.items);

  // 🔍 Auto-resolver productId por descrição (caso o utilizador tenha escrito o item à mão
  // em vez de o seleccionar do modal). Match exacto e case-insensitive.
  const itemsSemProductId = cleanedItems.filter(i => !i.productId && i.description);
  if (itemsSemProductId.length) {
    const descricoes = itemsSemProductId.map(i => String(i.description).trim());
    const regexes = descricoes.map(d => new RegExp(`^${d.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'));
    const matched = await Product.find({
      companyId,
      active: true,
      description: { $in: regexes }
    }).select('_id description').lean();

    if (matched.length) {
      const byDesc = new Map(matched.map(p => [String(p.description).trim().toLowerCase(), p]));
      cleanedItems = cleanedItems.map(item => {
        if (item.productId) return item;
        const found = byDesc.get(String(item.description || '').trim().toLowerCase());
        return found ? { ...item, productId: String(found._id) } : item;
      });
    }
  }

  // 🔒 Revalidar preços e existência de stock para itens ligados a produtos
  const productIds = cleanedItems
    .map(i => i.productId)
    .filter(id => id && mongoose.Types.ObjectId.isValid(id));

  let productsMap = new Map();
  if (productIds.length) {
    const products = await Product.find({
      _id: { $in: productIds },
      companyId,
    });
    productsMap = new Map(products.map(p => [String(p._id), p]));

    // força preço da BD (vendedor não pode alterar) e valida stock (apenas produtos físicos)
    cleanedItems = cleanedItems.map(item => {
      if (!item.productId) return item;
      const product = productsMap.get(String(item.productId));
      if (!product) {
        throw new Error(`Produto não encontrado: ${item.description || item.productId}`);
      }
      if (product.type !== 'service' && Number(product.stock?.quantity || 0) < Number(item.quantity)) {
        throw new Error(`Stock insuficiente: ${product.description}`);
      }
      return {
        ...item,
        description: product.description,
        unitPrice: Number(product.unitPrice),
      };
    });
  }

  const { subTotal, tax, totalAmount } = amounts(cleanedItems, req.body.iva * 1 * 0.01);

  // Gerar número real da factura (ignora o que vem do frontend)
  const invoiceNumber = await getNextInvoiceNumber(companyId);

  const invoice = new Invoice({
    docType: "invoice",
    companyName: req.body.companyName,
    clientName: req.body.clientName,
    clientNUIT: req.body.clientNUIT || "N/A",
    invoiceNumber,
    date: req.body.date,
    items: cleanedItems,
    appliedTax: req.body.iva * 1 * 0.01,
    subTotal,
    tax,
    totalAmount,
    dueDate: req.body.date,
    companyId,
    userId,
    clientId: req.body.clientId || null
  });

  await invoice.save();

  // 📦 Dar baixa no stock para os itens ligados a produtos
  const productItems = cleanedItems
    .filter(i => i.productId)
    .map(i => ({ productId: i.productId, quantity: Number(i.quantity) }));

  if (productItems.length) {
    try {
      await processSale({
        items: productItems,
        companyId,
        saleId: invoice._id,
        userId,
        session: null,
        referenceModel: 'Invoice',
        reason: `Factura ${invoice.invoiceNumber}`,
      });
    } catch (err) {
      // rollback da factura para manter consistência
      await Invoice.deleteOne({ _id: invoice._id });
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  logActivity({
    companyId, userId, userName: req.user.name,
    action: 'created', entity: 'invoice', entityId: invoice._id,
    description: `Criou factura ${invoice.invoiceNumber} para ${invoice.clientName} no valor de ${totalAmount} MZN.`
  });

  res.status(201).json({
    success: true,
    message: "Factura criada com sucesso.",
    invoice,
    downloadUrl: `/api/invoices/${invoice._id}/pdf`
  });
  } catch (error) {
    console.error("Erro ao criar factura:", error);
    return res.status(400).json({ success: false, message: error.message || "Erro ao criar factura." });
  }
};

exports.getInvoices = async (req, res) => {
  const companyId = req.user.company._id;
  const invoices = await Invoice.find({
    companyId,
    docType: 'invoice',
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
  try {
    const companyId = req.user.company._id;
    const nextStatus = String(req.body.status || "").toLowerCase().trim();

    if (!["paid", "unpaid", "overdue"].includes(nextStatus)) {
      return res.status(400).json({
        success: false,
        message: "Status inválido.",
      });
    }

    const invoice = await Invoice.findOne({
      _id: req.params.id,
      companyId,
    });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Fatura não encontrada",
      });
    }

    const previousStatus = invoice.status;

    // Sem alterações
    if (previousStatus === nextStatus) {
      let existingReceipt = null;

      if (nextStatus === "paid") {
        existingReceipt = await Recibo.findOne({
          companyId,
          invoiceId: invoice._id,
        });
      }

      return res.json({
        success: true,
        message: "Sem alterações.",
        invoiceStatus: invoice.status,
        receipt: existingReceipt
          ? {
            _id: existingReceipt._id,
            receiptNumber: existingReceipt.reciboNumber,
            pdfUrl: `/api/recibos/${existingReceipt._id}/pdf`,
          }
          : null,
      });
    }

    // Bloqueia reversão directa
    if (previousStatus === "paid" && nextStatus !== "paid") {
      return res.status(400).json({
        success: false,
        message: "Não é permitido reverter uma factura paga.",
      });
    }

    invoice.status = nextStatus;
    await invoice.save();

    let receiptPayload = null;

    // Só gera recibo quando transita para pago
    if (previousStatus !== "paid" && nextStatus === "paid") {
      let existingRecibo = await Recibo.findOne({
        companyId,
        invoiceId: invoice._id,
      });

      if (!existingRecibo) {
        const newNumber = await getNextReciboNumber(companyId);

        try {
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
            companyId,
            userId: req.user._id,
            invoiceId: invoice._id,
          });

          await recibo.save();

          receiptPayload = {
            _id: recibo._id,
            receiptNumber: recibo.reciboNumber,
            pdfUrl: `/api/recibos/${recibo._id}/pdf`,
          };
        } catch (error) {
          // Se falhar por duplicado, busca o já criado
          if (error.code === 11000) {
            existingRecibo = await Recibo.findOne({
              companyId,
              invoiceId: invoice._id,
            });

            if (existingRecibo) {
              receiptPayload = {
                _id: existingRecibo._id,
                receiptNumber: existingRecibo.reciboNumber,
                pdfUrl: `/api/recibos/${existingRecibo._id}/pdf`,
              };
            }
          } else {
            throw error;
          }
        }
      } else {
        receiptPayload = {
          _id: existingRecibo._id,
          receiptNumber: existingRecibo.reciboNumber,
          pdfUrl: `/api/recibos/${existingRecibo._id}/pdf`,
        };
      }
    }

    logActivity({
      companyId, userId: req.user._id, userName: req.user.name,
      action: nextStatus === 'paid' ? 'paid' : 'updated', entity: 'invoice', entityId: invoice._id,
      description: nextStatus === 'paid'
        ? `Marcou factura ${invoice.invoiceNumber} como paga.`
        : `Actualizou estado da factura ${invoice.invoiceNumber} para ${nextStatus}.`
    });

    return res.json({
      success: true,
      message:
        nextStatus === "paid"
          ? "Factura marcada como paga com sucesso."
          : "Estado da factura actualizado com sucesso.",
      invoiceStatus: invoice.status,
      receipt: receiptPayload,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Erro ao actualizar factura.",
    });
  }
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
    let pdfBuffer;
    let filename;
    const baseUrl = `${req.protocol}://${req.get('host')}`;

    if (invoice.docType === 'credit_note') {
      const related = invoice.relatedInvoiceId ? await Invoice.findById(invoice.relatedInvoiceId) : null;
      pdfBuffer = await generateCreditNotePDF(companyInfo, invoice, related?.invoiceNumber, baseUrl);
      filename = `nota-credito-${invoice.invoiceNumber}.pdf`;
    } else if (invoice.docType === 'debit_note') {
      const related = invoice.relatedInvoiceId ? await Invoice.findById(invoice.relatedInvoiceId) : null;
      pdfBuffer = await generateDebitNotePDF(companyInfo, invoice, related?.invoiceNumber, baseUrl);
      filename = `nota-debito-${invoice.invoiceNumber}.pdf`;
    } else {
      pdfBuffer = await generateInvoicePDF(companyInfo, invoice, baseUrl);
      filename = `factura-${invoice.invoiceNumber}.pdf`;
    }

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=${filename}`,
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
      subTotal: inv.subTotal,
      tax: inv.tax,
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