const Product = require("../models/product");
const StockMovement = require("../models/stockMovement");
const PriceHistory = require("../models/priceHistory");
const Subscription = require('../models/subscription');
const { getPlan } = require('../utils/plans');
const { log: logActivity } = require('./activityLogController');
const ExcelJS = require('exceljs');

// helper
function toNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

exports.createProduct = async (req, res) => {
  try {
    const companyId = req.user.company._id;

    const {
      description,
      sku,
      unitPrice,
      costPrice,
      barcode,
      category,
      unit,
      stockQuantity,
      stockMin,
      active,
      type,
      expiryDate,
      expiryAlertDays,
    } = req.body;

    const itemType = type === 'service' ? 'service' : 'product';

    if (!description || !String(description).trim()) {
      return res.status(400).json({ status: "error", message: "Informe o nome do produto." });
    }

    const price = toNumber(unitPrice, NaN);
    if (!Number.isFinite(price) || price < 0) {
      return res.status(400).json({ status: "error", message: "Preço unitário inválido." });
    }

    const cost = toNumber(costPrice, 0);
    if (cost < 0) {
      return res.status(400).json({ status: "error", message: "Preço de custo inválido." });
    }

    const product = await Product.create({
      companyId,
      description: String(description).trim(),
      type: itemType,
      sku: sku ? String(sku).trim() : undefined,
      unitPrice: price,
      costPrice: cost,
      barcode: barcode ? String(barcode).trim() : "",
      category: category ? String(category).trim() : "",
      unit: unit || "un",
      stock: itemType === 'service'
        ? { quantity: 0, min: 0 }
        : { quantity: toNumber(stockQuantity, 0), min: toNumber(stockMin, 0) },
      active: active === undefined ? true : Boolean(active),
      expiryDate: expiryDate ? new Date(expiryDate) : null,
      expiryAlertDays: toNumber(expiryAlertDays, 30),
    });

    logActivity({
      companyId: req.user.company._id, userId: req.user._id, userName: req.user.name,
      action: 'created', entity: 'product', entityId: product._id,
      description: `Criou produto "${product.description}".`
    });

    return res.status(201).json({ status: "success", product });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: "error", message: "Erro ao criar produto" });
  }
};

exports.getProducts = async (req, res) => {
  try {
    const companyId = req.user.company._id;

    // filtros opcionais
    const { active, q } = req.query;

    const query = { companyId };

    if (active === "true") query.active = true;
    if (active === "false") query.active = false;

    if (q && String(q).trim()) {
      const term = String(q).trim();
      query.$or = [
        { description: { $regex: term, $options: "i" } },
        { sku: { $regex: term, $options: "i" } },
      ];
    }

    const products = await Product.find(query).sort({ createdAt: -1 }).lean();

    return res.json({ status: "success", products });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: "error", message: "Erro ao listar produtos" });
  }
};

exports.getProductById = async (req, res) => {
  try {
    const companyId = req.user.company._id;

    const product = await Product.findOne({
      _id: req.params.id,
      companyId,
    }).lean();

    if (!product) {
      return res.status(404).json({ status: "error", message: "Produto não encontrado" });
    }

    return res.json({ status: "success", product });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: "error", message: "Erro ao buscar produto" });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const companyId = req.user.company._id;

    const {
      description,
      sku,
      unitPrice,
      unit,
      stockQuantity,
      stockMin,
      active,
    } = req.body;

    const update = {};

    if (description !== undefined) update.description = String(description).trim();
    if (sku !== undefined) update.sku = String(sku).trim() || undefined;

    const isAdmin = req.user?.role === 'ADMIN';
    const { costPrice, barcode, category: prodCategory } = req.body;

    if (unitPrice !== undefined) {
      if (!isAdmin) {
        return res.status(403).json({ status: "error", message: "Apenas administradores podem alterar o preço de venda." });
      }
      const price = toNumber(unitPrice, NaN);
      if (!Number.isFinite(price) || price < 0) {
        return res.status(400).json({ status: "error", message: "Preço unitário inválido." });
      }
      update.unitPrice = price;
    }

    if (unit !== undefined) update.unit = unit;
    if (active !== undefined) update.active = Boolean(active);
    if (req.body.type !== undefined) {
      update.type = req.body.type === 'service' ? 'service' : 'product';
    }
    if (req.body.expiryDate !== undefined) {
      update.expiryDate = req.body.expiryDate ? new Date(req.body.expiryDate) : null;
    }
    if (req.body.expiryAlertDays !== undefined) {
      update.expiryAlertDays = toNumber(req.body.expiryAlertDays, 30);
    }

    if (costPrice !== undefined) {
      if (!isAdmin) {
        return res.status(403).json({ status: "error", message: "Apenas administradores podem alterar o preço de custo." });
      }
      update.costPrice = toNumber(costPrice, 0);
    }
    if (barcode !== undefined) update.barcode = String(barcode).trim();
    if (prodCategory !== undefined) update.category = String(prodCategory).trim();

    // stock (se vier)
    if (stockQuantity !== undefined) update["stock.quantity"] = toNumber(stockQuantity, 0);
    if (stockMin !== undefined) update["stock.min"] = toNumber(stockMin, 0);

    // Track price changes before updating
    if (update.unitPrice !== undefined || update.costPrice !== undefined) {
      const oldProduct = await Product.findOne({ _id: req.params.id, companyId }).lean();
      if (oldProduct && (oldProduct.unitPrice !== update.unitPrice || oldProduct.costPrice !== update.costPrice)) {
        PriceHistory.create({
          companyId, productId: req.params.id,
          oldPrice: oldProduct.unitPrice, newPrice: update.unitPrice ?? oldProduct.unitPrice,
          oldCostPrice: oldProduct.costPrice || 0, newCostPrice: update.costPrice ?? oldProduct.costPrice ?? 0,
          changedBy: req.user._id
        }).catch(() => {});
      }
    }

    const product = await Product.findOneAndUpdate(
      { _id: req.params.id, companyId },
      { $set: update },
      { new: true, runValidators: true }
    ).lean();

    if (!product) {
      return res.status(404).json({ status: "error", message: "Produto não encontrado" });
    }

    return res.json({ status: "success", product });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: "error", message: "Erro ao actualizar produto" });
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    const companyId = req.user.company._id;

    const product = await Product.findOneAndDelete({
      _id: req.params.id,
      companyId,
    });

    if (!product) {
      return res.status(404).json({ status: "error", message: "Produto não encontrado" });
    }

    return res.json({ status: "success", message: "Produto eliminado com sucesso" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: "error", message: "Erro ao eliminar produto" });
  }
};

/**
 * ✅ Ajuste rápido de stock (entrada/saída)
 * body: { type: "IN" | "OUT", quantity: number }
 */
exports.adjustStock = async (req, res) => {
  try {
    const companyId = req.user.company._id;
    const userId = req.user._id;

    let { type, quantity, reason, note, unitCost } = req.body;

    const q = toNumber(quantity, NaN);
    if (!Number.isFinite(q) || q <= 0) {
      return res.status(400).json({ status: "error", message: "Quantidade inválida." });
    }

    type = String(type || "IN").toUpperCase();
    if (!["IN", "OUT"].includes(type)) {
      return res.status(400).json({ status: "error", message: "Tipo inválido. Use IN ou OUT." });
    }

    reason = String(reason || "").trim();
    if (!reason) {
      return res.status(400).json({ status: "error", message: "Motivo é obrigatório." });
    }

    note = String(note || "").trim();

    const product = await Product.findOne({ _id: req.params.id, companyId });
    if (!product) {
      return res.status(404).json({ status: "error", message: "Produto não encontrado" });
    }

    const beforeQty = Number(product.stock?.quantity || 0);
    let movementCost = 0;

    if (type === "OUT") {
      if (beforeQty < q) {
        return res.status(400).json({ status: "error", message: "Stock insuficiente." });
      }
      product.stock.quantity = beforeQty - q;
    } else {
      const cost = toNumber(unitCost, NaN);
      if (Number.isFinite(cost) && cost >= 0) {
        movementCost = cost;
        // Custo médio ponderado
        const oldCost = Number(product.costPrice || 0);
        const newQty = beforeQty + q;
        product.costPrice = newQty > 0
          ? Number(((oldCost * beforeQty + cost * q) / newQty).toFixed(2))
          : cost;
      }
      product.stock.quantity = beforeQty + q;
    }

    await product.save();

    // ✅ regista o movimento
    await StockMovement.create({
      companyId,
      productId: product._id,
      type,
      quantity: q,
      unitCost: movementCost,
      reason,
      note,
      createdBy: userId,
      // opcional: guardares o "before/after" se adicionares no schema
      // beforeQty,
      // afterQty: product.stock.quantity,
    });

    return res.json({
      status: "success",
      message: "Stock actualizado com sucesso",
      product,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: "error", message: "Erro ao ajustar stock" });
  }
};

/**
 * ✅ Activar / Desactivar produto (soft)
 * body: { active: true|false }
 */
exports.setActive = async (req, res) => {
  try {
    const companyId = req.user.company._id;
    const { active } = req.body;

    const product = await Product.findOneAndUpdate(
      { _id: req.params.id, companyId },
      { $set: { active: Boolean(active) } },
      { new: true }
    ).lean();

    if (!product) {
      return res.status(404).json({ status: "error", message: "Produto não encontrado" });
    }

    return res.json({ status: "success", product });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: "error", message: "Erro ao actualizar estado do produto" });
  }
};

exports.deactivateProduct = async (req, res) => {
  try {
    const companyId = req.user.company._id;

    const product = await Product.findOneAndUpdate(
      { _id: req.params.id, companyId },
      { $set: { active: false } },
      { new: true }
    ).lean();

    if (!product) {
      return res.status(404).json({ status: "error", message: "Produto não encontrado" });
    }

    return res.json({ status: "success", message: "Produto desactivado com sucesso", product });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: "error", message: "Erro ao desactivar produto" });
  }
};

exports.adjustStockWithReason = async (req, res) => {
  try {
    const companyId = req.user.company._id;
    const userId = req.user._id;

    const { type, quantity, reason, note, unitCost } = req.body;

    const q = toNumber(quantity);
    if (!q || !Number.isFinite(q) || q <= 0) {
      return res.status(400).json({ status: "error", message: "Quantidade inválida." });
    }

    const t = String(type || "").toUpperCase();
    if (!["IN", "OUT"].includes(t)) {
      return res.status(400).json({ status: "error", message: "Tipo inválido (IN/OUT)." });
    }

    if (!reason || !String(reason).trim()) {
      return res.status(400).json({ status: "error", message: "Informe o motivo." });
    }

    const product = await Product.findOne({ _id: req.params.id, companyId });
    if (!product) {
      return res.status(404).json({ status: "error", message: "Produto não encontrado." });
    }

    if (!product.active) {
      return res.status(400).json({ status: "error", message: "Produto desactivado." });
    }

    if (t === "OUT" && product.stock.quantity < q) {
      return res.status(400).json({ status: "error", message: "Stock insuficiente." });
    }

    const beforeQty = Number(product.stock.quantity || 0);
    let movementCost = 0;

    if (t === "IN") {
      const cost = toNumber(unitCost, NaN);
      if (Number.isFinite(cost) && cost >= 0) {
        movementCost = cost;
        const oldCost = Number(product.costPrice || 0);
        const newQty = beforeQty + q;
        product.costPrice = newQty > 0
          ? Number(((oldCost * beforeQty + cost * q) / newQty).toFixed(2))
          : cost;
      }
      product.stock.quantity = beforeQty + q;
    } else {
      product.stock.quantity = beforeQty - q;
    }

    await product.save();

    // guarda movimento
    await StockMovement.create({
      companyId,
      productId: product._id,
      type: t,
      quantity: q,
      unitCost: movementCost,
      reason: String(reason).trim(),
      note: note ? String(note).trim() : undefined,
      createdBy: userId,
    });

    return res.json({ status: "success", message: "Stock actualizado com sucesso", product });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: "error", message: "Erro ao ajustar stock" });
  }
};
// ═════════════════════════════════════════════════════════════════════════════
//  IMPORT / TEMPLATE EXCEL
// ═════════════════════════════════════════════════════════════════════════════

exports.downloadImportTemplate = async (req, res) => {
  try {
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Produtos');

    ws.columns = [
      { header: 'Nome (obrigatório)', key: 'description', width: 32 },
      { header: 'Tipo (product/service)', key: 'type', width: 20 },
      { header: 'SKU', key: 'sku', width: 15 },
      { header: 'Preço Venda (MZN)', key: 'unitPrice', width: 18 },
      { header: 'Preço Custo (MZN)', key: 'costPrice', width: 18 },
      { header: 'Stock Inicial', key: 'stockQuantity', width: 14 },
      { header: 'Stock Mínimo', key: 'stockMin', width: 14 },
      { header: 'Unidade (un/kg/lt/cx)', key: 'unit', width: 18 },
      { header: 'Código de Barras', key: 'barcode', width: 18 },
      { header: 'Categoria', key: 'category', width: 18 },
    ];

    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF228CDF' } };
    ws.getRow(1).height = 24;

    ws.addRow({ description: 'Paracetamol 500mg', type: 'product', sku: 'PAR-500', unitPrice: 50, costPrice: 30, stockQuantity: 100, stockMin: 20, unit: 'un', barcode: '', category: 'Farmácia' });
    ws.addRow({ description: 'Consultoria de TI (hora)', type: 'service', sku: '', unitPrice: 1500, costPrice: 0, stockQuantity: 0, stockMin: 0, unit: 'un', barcode: '', category: 'Serviços' });
    ws.addRow({ description: 'Açúcar 1kg', type: 'product', sku: 'AC-1KG', unitPrice: 80, costPrice: 55, stockQuantity: 50, stockMin: 10, unit: 'kg', barcode: '', category: 'Alimentação' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="template-produtos.xlsx"');
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
};

exports.importProducts = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ status: 'error', message: 'Nenhum ficheiro enviado.' });
    const companyId = req.user.company._id;

    const sub = await Subscription.findOne({ companyId });
    const plan = getPlan(sub?.plan || 'FREE');
    const currentCount = await Product.countDocuments({ companyId });
    const remaining = plan.maxProducts === Infinity ? Infinity : Math.max(0, plan.maxProducts - currentCount);

    if (remaining === 0) {
      return res.status(403).json({
        status: 'error',
        limitReached: true,
        message: `Atingiste o limite de ${plan.maxProducts} produto(s) no plano ${plan.label}. Faz upgrade para importar mais.`,
        upgradeUrl: '/upgrade'
      });
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);
    const ws = workbook.worksheets[0];
    if (!ws) return res.status(400).json({ status: 'error', message: 'Excel vazio.' });

    const headers = {};
    ws.getRow(1).eachCell((cell, colIdx) => {
      headers[String(cell.value || '').toLowerCase().trim()] = colIdx;
    });

    function pickCell(row, ...candidates) {
      for (const c of candidates) {
        const idx = headers[c.toLowerCase()];
        if (idx) {
          const v = row.getCell(idx).value;
          if (v !== null && v !== undefined && String(v).trim() !== '') return v;
        }
      }
      return '';
    }

    const toNum = (v) => {
      if (v === null || v === undefined || v === '') return 0;
      const n = Number(String(v).replace(',', '.').replace(/[^\d.-]/g, ''));
      return Number.isFinite(n) ? n : 0;
    };

    const created = [];
    const skipped = [];
    let remainingSlots = remaining;

    for (let i = 2; i <= ws.rowCount; i++) {
      const row = ws.getRow(i);
      const description = String(pickCell(row, 'nome (obrigatório)', 'nome', 'descrição', 'description') || '').trim();
      if (!description) continue;

      if (remainingSlots !== Infinity && remainingSlots <= 0) {
        skipped.push({ row: i, reason: `Limite do plano ${plan.label} atingido`, description });
        continue;
      }

      const unitPrice = toNum(pickCell(row, 'preço venda (mzn)', 'preço venda', 'preço', 'unitprice'));
      if (unitPrice < 0) { skipped.push({ row: i, reason: 'Preço inválido', description }); continue; }

      const typeRaw = String(pickCell(row, 'tipo (product/service)', 'tipo', 'type') || 'product').toLowerCase().trim();
      const type = typeRaw === 'service' || typeRaw === 'serviço' || typeRaw === 'servico' ? 'service' : 'product';
      const unitRaw = String(pickCell(row, 'unidade (un/kg/lt/cx)', 'unidade', 'unit') || 'un').toLowerCase().trim();
      const unit = ['un', 'kg', 'lt', 'cx'].includes(unitRaw) ? unitRaw : 'un';

      const sku = String(pickCell(row, 'sku') || '').trim();
      const dupQuery = sku
        ? { companyId, sku }
        : { companyId, description: new RegExp('^' + description.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') };
      const existing = await Product.findOne(dupQuery).select('_id').lean();
      if (existing) {
        skipped.push({ row: i, reason: sku ? `Já existe produto com SKU ${sku}` : 'Já existe produto com esta descrição', description });
        continue;
      }

      try {
        const product = await Product.create({
          companyId,
          description,
          type,
          sku: sku || undefined,
          unitPrice,
          costPrice: toNum(pickCell(row, 'preço custo (mzn)', 'preço custo', 'costprice')),
          barcode: String(pickCell(row, 'código de barras', 'codigo de barras', 'barcode') || '').trim(),
          category: String(pickCell(row, 'categoria', 'category') || '').trim(),
          unit,
          stock: type === 'service'
            ? { quantity: 0, min: 0 }
            : { quantity: toNum(pickCell(row, 'stock inicial', 'stockquantity')), min: toNum(pickCell(row, 'stock mínimo', 'stock minimo', 'stockmin')) },
          active: true,
        });
        created.push(product._id);
        if (remainingSlots !== Infinity) remainingSlots--;
      } catch (err) {
        skipped.push({ row: i, reason: err.message, description });
      }
    }

    logActivity({
      companyId: req.user.company._id, userId: req.user._id, userName: req.user.name,
      action: 'created', entity: 'product',
      description: `Importou ${created.length} produto(s) via Excel.`
    });

    return res.json({
      status: 'success',
      created: created.length,
      skipped: skipped.length,
      details: skipped.slice(0, 20)
    });
  } catch (err) {
    console.error('[importProducts]', err);
    return res.status(500).json({ status: 'error', message: 'Erro ao importar: ' + err.message });
  }
};
