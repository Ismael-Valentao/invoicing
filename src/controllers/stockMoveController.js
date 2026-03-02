const StockMovement = require("../models/stockMovement");

function startOfDay(d) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
}

function endOfDay(d) {
    const x = new Date(d);
    x.setHours(23, 59, 59, 999);
    return x;
}

exports.getStockMovements = async (req, res) => {
    try {
        const companyId = req.user.company._id;

        const { productId, type, startDate, endDate } = req.query;

        const query = { companyId };

        if (productId) query.productId = productId;

        if (type && ["IN", "OUT"].includes(String(type).toUpperCase())) {
            query.type = String(type).toUpperCase();
        }

        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) query.createdAt.$gte = startOfDay(startDate);
            if (endDate) query.createdAt.$lte = endOfDay(endDate);
        }

        const movements = await StockMovement.find(query)
            .populate("productId", "description sku unit")
            .populate({
                path: "reference.id",
                select: "_id receiptNumber total",
            })
            .sort({ createdAt: -1 })
            .lean();

        return res.json({ status: "success", movements });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ status: "error", message: "Erro ao buscar movimentos de stock" });
    }
};