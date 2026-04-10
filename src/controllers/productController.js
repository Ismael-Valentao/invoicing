const Product = require("../models/product");
const StockMovement = require("../models/stockMovement");
const PriceHistory = require("../models/priceHistory");
const { log: logActivity } = require('./activityLogController');

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

    return res.json({ status: "success", message: "Produto excluído com sucesso" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: "error", message: "Erro ao excluir produto" });
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
      message: "Stock atualizado com sucesso",
      product,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: "error", message: "Erro ao ajustar stock" });
  }
};

/**
 * ✅ Ativar / Desativar produto (soft)
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

    return res.json({ status: "success", message: "Produto desativado com sucesso", product });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: "error", message: "Erro ao desativar produto" });
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
      return res.status(400).json({ status: "error", message: "Produto desativado." });
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

    return res.json({ status: "success", message: "Stock atualizado com sucesso", product });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: "error", message: "Erro ao ajustar stock" });
  }
};