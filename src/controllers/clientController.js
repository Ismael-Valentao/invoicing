const Client = require('../models/client');

function normalizeOptionalField(value, fallback = undefined) {
    if (value === undefined || value === null) return fallback;

    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed === '' ? fallback : trimmed;
    }

    return value;
}

exports.createClient = async (req, res) => {
    try {
        const { name, email, phone, address, nuit } = req.body;
        const companyId = req.user.company._id;

        const clientData = {
            name: name?.trim(),
            phone: normalizeOptionalField(phone, 'N/A'),
            address: normalizeOptionalField(address, 'N/A'),
            nuit: normalizeOptionalField(nuit, 'N/A'),
            companyId
        };

        const normalizedEmail = normalizeOptionalField(email);
        if (normalizedEmail) {
            clientData.email = normalizedEmail;
        }

        const client = new Client(clientData);

        await client.save();
        return res.status(201).json({ success: true, client });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                error: 'Já existe um cliente com este email nesta empresa'
            });
        }

        return res.status(500).json({
            success: false,
            error: 'Erro ao criar cliente'
        });
    }
};

exports.getClients = async (req, res) => {
    try {
        const companyId = req.user.company._id;
        const clients = await Client.find({ companyId });

        return res.json({ status: 'success', clients });
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: 'Erro ao listar clientes'
        });
    }
};

exports.getClientById = async (req, res) => {
    try {
        const companyId = req.user.company._id;
        const client = await Client.findOne({ _id: req.params.id, companyId });

        if (!client) {
            return res.status(404).json({ error: 'Cliente não encontrado' });
        }

        return res.json({ status: 'success', client });
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: 'Erro ao obter cliente'
        });
    }
};

exports.updateClient = async (req, res) => {
    try {
        const companyId = req.user.company._id;

        const updateData = {
            ...req.body
        };

        if ('name' in updateData && typeof updateData.name === 'string') {
            updateData.name = updateData.name.trim();
        }

        if ('phone' in updateData) {
            updateData.phone = normalizeOptionalField(updateData.phone, 'N/A');
        }

        if ('address' in updateData) {
            updateData.address = normalizeOptionalField(updateData.address, 'N/A');
        }

        if ('nuit' in updateData) {
            updateData.nuit = normalizeOptionalField(updateData.nuit, 'N/A');
        }

        if ('email' in updateData) {
            const normalizedEmail = normalizeOptionalField(updateData.email);

            if (normalizedEmail) {
                updateData.email = normalizedEmail;
            } else {
                updateData.$unset = { email: 1 };
                delete updateData.email;
            }
        }

        const client = await Client.findOneAndUpdate(
            { _id: req.params.id, companyId },
            updateData,
            { new: true, runValidators: true }
        );

        if (!client) {
            return res.status(404).json({ error: 'Cliente não encontrado' });
        }

        return res.json({ status: 'success', client });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                error: 'Já existe um cliente com este email nesta empresa'
            });
        }

        return res.status(500).json({
            success: false,
            error: 'Erro ao actualizar cliente'
        });
    }
};

exports.deleteClient = async (req, res) => {
    try {
        const companyId = req.user.company._id;
        const client = await Client.findOneAndDelete({ _id: req.params.id, companyId });

        if (!client) {
            return res.status(404).json({ error: 'Cliente não encontrado' });
        }

        return res.json({ status: 'success', message: 'Cliente excluído com sucesso' });
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: 'Erro ao excluir cliente'
        });
    }
};