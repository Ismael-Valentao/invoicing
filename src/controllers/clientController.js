const Client = require('../models/client');

exports.createClient = async (req, res) => {
    const { name, email, phone, address, nuit } = req.body;
    console.log(req.body)
    const companyId = req.user.company._id;
    const client = new Client({
        name,
        email,
        phone,
        address,
        nuit,
        companyId
    });

    await client.save();
    res.status(201).json({ success: true, client });
}

exports.getClients = async (req, res) => {
    const companyId = req.user.company._id;
    const clients = await Client.find({ companyId });
    if (!clients) {
        return res.status(404).json({ error: 'Nenhum cliente encontrado' });
    }   
    return res.json({ status: 'success', clients });
}

exports.getClientById = async (req, res) => {
    const companyId = req.user.company._id;
    const client = await Client.findOne({ _id: req.params.id, companyId });
    if (!client) {
        return res.status(404).json({ error: 'Cliente não encontrado' });
    }
    return res.json({ status: 'success', client });
}

exports.updateClient = async (req, res) => {
    const companyId = req.user.company._id;
    const client = await Client.findOneAndUpdate({ _id: req.params.id, companyId }, req.body, { new: true });
    if (!client) {
        return res.status(404).json({ error: 'Cliente não encontrado' });
    }
    return res.json({ status: 'success', client });
}

exports.deleteClient = async (req, res) => {
    const companyId = req.user.company._id;
    const client = await Client.findOneAndDelete({ _id: req.params.id, companyId });
    if (!client) {
        return res.status(404).json({ error: 'Cliente não encontrado' });
    }
    return res.json({ status: 'success', message: 'Cliente excluído com sucesso' });
}


