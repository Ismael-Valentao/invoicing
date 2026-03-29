const Supplier = require('../models/supplier');

exports.createSupplier = async (req, res) => {
    try {
        const { name, email, phone, address, nuit, notes } = req.body;
        if (!name) return res.status(400).json({ success: false, message: 'Nome é obrigatório.' });
        const supplier = await Supplier.create({ companyId: req.user.company._id, name, email, phone, address, nuit, notes });
        res.json({ success: true, supplier });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.getSuppliers = async (req, res) => {
    try {
        const suppliers = await Supplier.find({ companyId: req.user.company._id }).sort({ name: 1 });
        res.json({ success: true, suppliers });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.updateSupplier = async (req, res) => {
    try {
        const supplier = await Supplier.findOneAndUpdate(
            { _id: req.params.id, companyId: req.user.company._id },
            { $set: req.body },
            { new: true }
        );
        if (!supplier) return res.status(404).json({ success: false, message: 'Fornecedor não encontrado.' });
        res.json({ success: true, supplier });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.deleteSupplier = async (req, res) => {
    try {
        await Supplier.findOneAndDelete({ _id: req.params.id, companyId: req.user.company._id });
        res.json({ success: true, message: 'Fornecedor eliminado.' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};