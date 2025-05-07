const Product = require('../models/product');

exports.createProduct = async (req, res) => {
    const { description, quantity, unitPrice } = req.body;
    const companyId = req.user.company._id;
    const product = new Product({
        description,
        quantity : quantity || 1,
        unitPrice,
        companyId
    });

    await product.save();
    res.status(201).json({ success: true, product });
}

exports.getProducts = async (req, res) => {
    const companyId = req.user.company._id;
    const products = await Product.find({ companyId });
    if (!products) {
        return res.status(404).json({ error: 'Nenhum produto encontrado' });
    }
    return res.json({ status: 'success', products });
}

exports.getProductById = async (req, res) => {
    const companyId = req.user.company._id;
    const product = await Product.findOne({ _id: req.params.id, companyId });
    if (!product) {
        return res.status(404).json({ error: 'Produto não encontrado' });
    }
    return res.json({ status: 'success', product });
}

exports.updateProduct = async (req, res) => {
    const companyId = req.user.company._id;
    const product = await Product.findOneAndUpdate({ _id: req.params.id, companyId }, req.body, { new: true });
    if (!product) {
        return res.status(404).json({ error: 'Produto não encontrado' });
    }
    return res.json({ status: 'success', product });
}

exports.deleteProduct = async (req, res) => {
    const companyId = req.user.company._id;
    const product = await Product.findOneAndDelete({ _id: req.params.id, companyId });
    if (!product) {
        return res.status(404).json({ error: 'Produto não encontrado' });
    }
    return res.json({ status: 'success', message: 'Produto excluído com sucesso' });
}



