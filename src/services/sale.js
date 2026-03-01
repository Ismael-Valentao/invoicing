const Product = require('../models/product');
const StockMovement = require('../models/stockMovement');

async function processSale({ items, companyId, saleId, userId, session }) {

    for (const item of items) {

        const product = await Product.findOne({
            _id: item.productId,
            companyId
        }).session(session);

        if (!product) {
            throw new Error('Produto não encontrado');
        }

        if (product.stock.quantity < item.quantity) {
            throw new Error(`Stock insuficiente: ${product.description}`);
        }

        // Atualiza stock
        product.stock.quantity -= item.quantity;
        await product.save({ session });

        // Movimento
        await StockMovement.create([{
            productId: product._id,
            companyId,
            type: 'OUT',
            quantity: item.quantity,
            reason: 'Venda',
            reference: {
                model: 'Sale',
                id: saleId
            },
            createdBy: userId
        }], { session });
    }
}


async function revertSale({ items, companyId, saleId, userId, session }) {

    for (const item of items) {

        const product = await Product.findOne({
            _id: item.productId,
            companyId
        }).session(session);

        if (!product) {
            throw new Error('Produto não encontrado');
        }

        // Devolve stock
        product.stock.quantity += item.quantity;
        await product.save({ session });

        // Movimento inverso
        await StockMovement.create([{
            productId: product._id,
            companyId,
            type: 'IN',
            quantity: item.quantity,
            reason: 'Cancelamento de venda',
            reference: {
                model: 'Sale',
                id: saleId
            },
            createdBy: userId
        }], { session });
    }
}

module.exports = {
    processSale,
    revertSale
};