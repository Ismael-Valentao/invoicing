const mongoose = require('mongoose');
const Sale = require('../models/sale');
const ExcelJS = require("exceljs");

const { processSale, revertSale } = require('../services/sale');
const { generateSaleReceiptPDFKit } = require('../utils/pdfGenerator');
const { getNextReceiptNumber } = require('../utils/numerationGenerator');
const Product = require('../models/product');
const { log: logActivity } = require('./activityLogController');

const isDev = process.env.NODE_ENV === 'Development';

function formatCurrencyNumber(v) {
  const n = Number(v || 0);
  return Number.isFinite(n) ? n : 0;
}

// ✅ Criar venda
exports.createSale = async (req, res) => {

    const session = !isDev ? await mongoose.startSession() : null;

    try {

        if (!isDev) {
            session.startTransaction();
        }

        const { items, customerId, paidAmount, paymentMethod } = req.body;

        if (!items || !items.length) {
            throw new Error('Venda sem produtos');
        }

        // 🔎 Buscar produtos reais na BD
        const productIds = items.map(i => i.productId);

        const products = await Product.find({
            _id: { $in: productIds },
            companyId: req.user.company._id
        });

        if (!products.length) {
            throw new Error('Produtos inválidos');
        }

        // 🔥 Criar snapshot dos itens
        const saleItems = items.map(item => {

            const product = products.find(p =>
                p._id.toString() === item.productId
            );

            if (!product) {
                throw new Error('Produto não encontrado');
            }

            return {
                productId: product._id,
                name: product.description, // ✅ agora salva descrição
                price: product.unitPrice,         // ✅ preço vem da BD
                quantity: Number(item.quantity)
            };
        });

        // 💰 Calcular total seguro
        const total = saleItems.reduce(
            (sum, i) => sum + (i.quantity * i.price),
            0
        );
        const paidNum = Number(paidAmount);
        const paid = Number.isFinite(paidNum) && paidNum > 0 ? paidNum : total;

        if (paid < total) {
            throw new Error('Valor pago insuficiente');
        }

        const receiptNumber = await getNextReceiptNumber(req.user.company._id, session);

        const saleData = {
            companyId: req.user.company._id,
            receiptNumber,
            customerId,
            items: saleItems,
            total,
            paidAmount: paid,
            paymentMethod: paymentMethod || "cash",
            status: 'confirmed'
        };

        const sale = isDev
            ? await Sale.create(saleData)
            : (await Sale.create([saleData], { session }))[0];

        await processSale({
            items: saleItems,
            companyId: req.user.company._id,
            saleId: sale._id,
            userId: req.user._id,
            session: isDev ? null : session
        });

        if (!isDev) {
            await session.commitTransaction();
            session.endSession();
        }

        logActivity({
            companyId: req.user.company._id, userId: req.user._id, userName: req.user.name,
            action: 'created', entity: 'sale', entityId: sale._id,
            description: `Registou venda ${sale.receiptNumber || ''} no valor de ${sale.total} MZN.`
        });

        const pdfBuffer = await generateSaleReceiptPDFKit(req.user.company, sale);

        res.set({
            "Content-Type": "application/pdf",
            "Content-Length": pdfBuffer.length,
        });

        return res.send(pdfBuffer);

    } catch (error) {

        if (!isDev && session) {
            await session.abortTransaction();
            session.endSession();
        }

        return res.status(400).json({ message: error.message });
    }
};

// ✅ Listar vendas
exports.getSales = async (req, res) => {

    const sales = await Sale.find({
        companyId: req.user.company._id
    }).sort({ createdAt: -1 });

    res.json(sales);
};


// ✅ Buscar venda por ID
exports.getSaleById = async (req, res) => {

    const sale = await Sale.findOne({
        _id: req.params.id,
        companyId: req.user.company._id
    });

    if (!sale) {
        return res.status(404).json({ message: 'Venda não encontrada' });
    }

    res.json(sale);
};


// ✅ Cancelar venda
exports.cancelSale = async (req, res) => {

    const session = !isDev ? await mongoose.startSession() : null;

    try {

        if (!isDev) {
            session.startTransaction();
        }

        const query = {
            _id: req.params.id,
            companyId: req.user.company._id
        };

        const sale = isDev
            ? await Sale.findOne(query)
            : await Sale.findOne(query).session(session);

        if (!sale) {
            throw new Error('Venda não encontrada');
        }

        if (sale.status === 'cancelled') {
            throw new Error('Venda já cancelada');
        }

        await revertSale({
            items: sale.items,
            companyId: sale.companyId,
            saleId: sale._id,
            userId: req.user._id,
            session: isDev ? null : session
        });

        sale.status = 'cancelled';

        isDev
            ? await sale.save()
            : await sale.save({ session });

        if (!isDev) {
            await session.commitTransaction();
            session.endSession();
        }

        logActivity({
            companyId: req.user.company._id, userId: req.user._id, userName: req.user.name,
            action: 'cancelled', entity: 'sale', entityId: sale._id,
            description: `Cancelou venda ${sale.receiptNumber || ''}.`
        });

        res.json({ message: 'Venda cancelada com sucesso' });

    } catch (error) {

        if (!isDev && session) {
            await session.abortTransaction();
            session.endSession();
        }

        res.status(400).json({ message: error.message });
    }
};

exports.getSaleReceiptPDF = async (req, res) => {
    try {
        const { id } = req.params;
        const sale = await Sale.findOne({
            _id: id,
            companyId: req.user.company._id,
        }).lean();

        if (!sale) {
            return res.status(404).json({ message: "Venda não encontrada" });
        }

        const companyInfo = req.user.company;

        const pdfBuffer = await generateSaleReceiptPDFKit(companyInfo, sale);

        // ✅ headers
        const receiptNo = sale.receiptNumber || String(sale._id).slice(-8);
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `inline; filename="recibo-${receiptNo}.pdf"`);
        res.setHeader("Content-Length", pdfBuffer.length);

        return res.send(pdfBuffer);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Erro ao gerar recibo" });
    }
};

function statusLabel(status) {
  const s = String(status || "").toLowerCase();
  if (s === "confirmed") return "Completa";
  if (s === "cancelled") return "Cancelada";
  return "—";
}

function toNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function paymentLabel(method) {
  const m = String(method || "").toLowerCase();

  // cobre variações comuns
  if (m === "cash" || m === "dinheiro") return "Dinheiro";
  if (m === "m-pesa" || m === "mpesa" || m === "m-pesa ") return "M-Pesa";
  if (m === "emola" || m === "e-mola" || m === "e-mola ") return "E-Mola";
  if (m === "card" || m === "cartao" || m === "cartão") return "Cartão";
  if (m === "transfer" || m === "transferencia" || m === "transferência") return "Transferência";

  // se vier vazio
  if (!m) return "—";

  // fallback: mantém o texto original
  return method;
}

exports.exportSalesExcel = async (req, res) => {
  try {
    const companyId = req.user.company._id;
    const companyName = req.user.company.name || "Empresa";

    const { startDate, endDate, status, paymentMethod } = req.query;

    const query = { companyId };

    // filtros técnicos continuam técnicos na query
    if (status) query.status = status;
    if (paymentMethod) query.paymentMethod = paymentMethod;

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(`${startDate}T00:00:00.000Z`);
      if (endDate) query.createdAt.$lte = new Date(`${endDate}T23:59:59.999Z`);
    }

    const sales = await Sale.find(query).sort({ createdAt: -1 }).lean();

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Invoicing";
    workbook.created = new Date();

    const sheet = workbook.addWorksheet("Vendas");

    // ====== Cabeçalho do relatório (linhas acima da tabela) ======
    sheet.addRow([`Relatório de Vendas — ${companyName}`]);
    sheet.getRow(1).font = { bold: true, size: 13 };
    sheet.addRow([`Gerado em: ${new Date().toLocaleString("pt-MZ")}`]);
    sheet.addRow([
      `Período: ${startDate || "—"} até ${endDate || "—"} | Estado: ${status ? statusLabel(status) : "Todos"} | Pagamento: ${paymentMethod ? paymentLabel(paymentMethod) : "Todos"}`
    ]);

    sheet.addRow([]); // linha em branco antes da tabela

    // ====== Tabela ======
    const headerRowIndex = sheet.rowCount + 1;

    sheet.columns = [
      { header: "Nº do Recibo", key: "receiptNumber", width: 18 },
      { header: "Itens", key: "itemsCount", width: 8 },
      { header: "Total (MZN)", key: "total", width: 14 },
      { header: "Pago (MZN)", key: "paidAmount", width: 14 },
      { header: "Troco (MZN)", key: "change", width: 14 },
      { header: "Pagamento", key: "paymentMethod", width: 16 },
      { header: "Estado", key: "status", width: 12 },
      { header: "Data", key: "createdAt", width: 20 },
    ];

    // Estilo do header da tabela
    const headerRow = sheet.getRow(headerRowIndex);
    headerRow.values = sheet.columns.map(c => c.header);

    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.alignment = { vertical: "middle", horizontal: "center" };
    headerRow.height = 18;

    headerRow.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4E73DF" } };
      cell.border = {
        top: { style: "thin", color: { argb: "FFDDDDDD" } },
        left: { style: "thin", color: { argb: "FFDDDDDD" } },
        bottom: { style: "thin", color: { argb: "FFDDDDDD" } },
        right: { style: "thin", color: { argb: "FFDDDDDD" } },
      };
    });

    // vamos começar a inserir dados a partir da linha seguinte ao header
    let dataStartRow = headerRowIndex + 1;

    let totalVendas = 0;
    let totalPago = 0;
    let totalTroco = 0;
    let totalItens = 0;

    for (const s of sales) {
      const itemsCount = (s.items || []).reduce((sum, i) => sum + (toNumber(i.quantity) || 0), 0);
      const total = toNumber(s.total);
      const paid = toNumber(s.paidAmount ?? total);
      const change = Math.max(0, paid - total);

      totalItens += itemsCount;

      // ✅ para análise do usuário: soma só vendas completas (faz mais sentido)
      if (String(s.status).toLowerCase() === "confirmed") {
        totalVendas += total;
        totalPago += paid;
        totalTroco += change;
      }

      const receipt = s.receiptNumber || String(s._id).slice(-8).toUpperCase();

      const row = sheet.getRow(dataStartRow++);
      row.values = {
        receiptNumber: receipt,
        itemsCount,
        total,
        paidAmount: paid,
        change,
        paymentMethod: paymentLabel(s.paymentMethod),
        status: statusLabel(s.status),
        createdAt: s.createdAt ? new Date(s.createdAt) : "",
      };

      row.getCell("C").numFmt = '#,##0.00';
      row.getCell("D").numFmt = '#,##0.00';
      row.getCell("E").numFmt = '#,##0.00';
      row.getCell("H").numFmt = "dd/mm/yyyy hh:mm";

      // alinhamento
      row.getCell("A").alignment = { horizontal: "center" };
      row.getCell("B").alignment = { horizontal: "center" };
      row.getCell("C").alignment = { horizontal: "right" };
      row.getCell("D").alignment = { horizontal: "right" };
      row.getCell("E").alignment = { horizontal: "right" };
      row.getCell("F").alignment = { horizontal: "center" };
      row.getCell("G").alignment = { horizontal: "center" };
    }

    // Linha em branco
    sheet.addRow([]);

    // ✅ Linha TOTAL (resumo)
    const totalRow = sheet.addRow([
      "TOTAL (vendas completas)",
      totalItens,
      totalVendas,
      totalPago,
      totalTroco,
      "",
      "",
      ""
    ]);

    totalRow.font = { bold: true };
    totalRow.getCell(3).numFmt = '#,##0.00';
    totalRow.getCell(4).numFmt = '#,##0.00';
    totalRow.getCell(5).numFmt = '#,##0.00';

    // estilo leve no total
    totalRow.eachCell((cell) => {
      cell.border = {
        top: { style: "thin", color: { argb: "FF999999" } },
        left: { style: "thin", color: { argb: "FFDDDDDD" } },
        bottom: { style: "double", color: { argb: "FF666666" } },
        right: { style: "thin", color: { argb: "FFDDDDDD" } },
      };
    });

    // Congelar até header da tabela (mantém as linhas do título visíveis ao rolar)
    sheet.views = [{ state: "frozen", ySplit: headerRowIndex }];

    // ✅ Download
    const fileName = `vendas-${new Date().toISOString().slice(0, 10)}.xlsx`;

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Erro ao exportar vendas" });
  }
};

exports.getSalesDataTable = async (req, res) => {
  try {
    const companyId = req.user.company._id;

    // DataTables params
    const draw = Number(req.query.draw || 1);
    const start = Number(req.query.start || 0); // offset
    const length = Number(req.query.length || 10); // page size
    const searchValue = (req.query.search?.value || "").trim();

    // filtros extras
    const { startDate, endDate, status, paymentMethod } = req.query;

    const query = { companyId };

    if (status) query.status = status;
    if (paymentMethod) query.paymentMethod = paymentMethod;

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(`${startDate}T00:00:00.000Z`);
      if (endDate) query.createdAt.$lte = new Date(`${endDate}T23:59:59.999Z`);
    }

    // Search (recibo ou id)
    if (searchValue) {
      query.$or = [
        { receiptNumber: { $regex: searchValue, $options: "i" } },
        // fallback: pesquisar pelo _id em string (não é perfeito, mas ajuda)
      ];
    }

    // Ordenação (mapeia colunas -> fields)
    const orderCol = Number(req.query.order?.[0]?.column ?? 6);
    const orderDir = (req.query.order?.[0]?.dir ?? "desc") === "asc" ? 1 : -1;

    const colMap = {
      0: "receiptNumber",
      1: "itemsCount", // virtual (não existe) -> vamos ordenar por createdAt
      2: "total",
      3: "paidAmount",
      4: "total", // troco também derivado
      5: "paymentMethod",
      6: "createdAt",
      7: "status",
    };

    const sortField = colMap[orderCol] || "createdAt";
    const sort = { [sortField]: orderDir };

    const recordsTotal = await Sale.countDocuments({ companyId });
    const recordsFiltered = await Sale.countDocuments(query);

    const data = await Sale.find(query)
      .sort(sort)
      .skip(start)
      .limit(length)
      .lean();

    // Envia itemsCount pronto (pra não calcular no frontend)
    const mapped = data.map((s) => ({
      ...s,
      itemsCount: (s.items || []).reduce((sum, i) => sum + (Number(i.quantity) || 0), 0),
    }));

    return res.json({
      draw,
      recordsTotal,
      recordsFiltered,
      data: mapped,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Erro ao carregar vendas" });
  }
};

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0,0,0,0);
  return x;
}

exports.getSalesDashboard = async (req, res) => {
  try {
    const companyId = req.user.company._id;
    const days = Math.max(1, Math.min(365, Number(req.query.days || 30)));

    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - (days - 1));

    const from = startOfDay(start);

    const sales = await Sale.find({
      companyId,
      createdAt: { $gte: from, $lte: end }
    }).sort({ createdAt: 1 }).lean();

    const confirmed = sales.filter(s => s.status === "confirmed");
    const cancelled = sales.filter(s => s.status === "cancelled");

    const totalSold = confirmed.reduce((sum, s) => sum + Number(s.total || 0), 0);
    const totalSales = confirmed.length;

    const lastConfirmed = [...confirmed].sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt))[0];

    // agrupar por dia
    const byDay = new Map();
    for (let i=0; i<days; i++) {
      const d = new Date(from);
      d.setDate(from.getDate()+i);
      const key = d.toISOString().slice(0,10); // YYYY-MM-DD
      byDay.set(key, 0);
    }

    confirmed.forEach(s => {
      const key = new Date(s.createdAt).toISOString().slice(0,10);
      byDay.set(key, (byDay.get(key) || 0) + Number(s.total || 0));
    });

    // pagamentos (linguagem corrente)
    const payMap = new Map(); // "Dinheiro" -> total
    const normalizePay = (pm) => {
      const x = String(pm || "").toLowerCase();
      if (x === "cash") return "Dinheiro";
      if (x === "mpesa") return "M-Pesa";
      if (x === "card") return "Cartão";
      if (x === "transfer") return "Transferência";
      if (!x) return "—";
      return pm;
    };

    confirmed.forEach(s => {
      const label = normalizePay(s.paymentMethod);
      payMap.set(label, (payMap.get(label) || 0) + Number(s.total || 0));
    });

    return res.json({
      status: "success",
      cards: {
        totalSold,
        totalSales,
        cancelledSales: cancelled.length,
        lastSale: lastConfirmed
          ? { date: lastConfirmed.createdAt, total: lastConfirmed.total, receipt: lastConfirmed.receiptNumber || String(lastConfirmed._id) }
          : null
      },
      charts: {
        byDay: Array.from(byDay.entries()).map(([date, total]) => ({ date, total })),
        payments: Array.from(payMap.entries()).map(([label, total]) => ({ label, total }))
      }
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ status: "error", message: "Erro ao carregar dashboard de vendas" });
  }
};