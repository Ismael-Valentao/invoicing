const Client = require('../models/client');
const Subscription = require('../models/subscription');
const { getPlan } = require('../utils/plans');
const { log: logActivity } = require('./activityLogController');

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
        logActivity({
            companyId: req.user.company._id, userId: req.user._id, userName: req.user.name,
            action: 'created', entity: 'client', entityId: client._id,
            description: `Adicionou cliente "${client.name}".`
        });
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

        return res.json({ status: 'success', message: 'Cliente eliminado com sucesso' });
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: 'Erro ao eliminar cliente'
        });
    }
};
// ═════════════════════════════════════════════════════════════════════════════
//  IMPORT / TEMPLATE EXCEL
// ═════════════════════════════════════════════════════════════════════════════

const ExcelJS = require('exceljs');

exports.downloadImportTemplate = async (req, res) => {
    try {
        const workbook = new ExcelJS.Workbook();
        const ws = workbook.addWorksheet('Clientes');

        ws.columns = [
            { header: 'Nome (obrigatório)', key: 'name', width: 32 },
            { header: 'NUIT', key: 'nuit', width: 15 },
            { header: 'Email', key: 'email', width: 28 },
            { header: 'Telefone', key: 'phone', width: 15 },
            { header: 'Endereço', key: 'address', width: 40 },
        ];

        ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF228CDF' } };
        ws.getRow(1).height = 24;

        ws.addRow({ name: 'João Cossa', nuit: '400123456', email: 'joao@exemplo.mz', phone: '84 123 4567', address: 'Av. 24 de Julho, 123, Maputo' });
        ws.addRow({ name: 'Maria Lda', nuit: '400987654', email: 'geral@marialda.co.mz', phone: '21 456 7890', address: 'Rua da Resistência, 45, Matola' });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="template-clientes.xlsx"');
        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        return res.status(500).json({ status: 'error', message: err.message });
    }
};

exports.importClients = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ status: 'error', message: 'Nenhum ficheiro enviado.' });
        const companyId = req.user.company._id;

        const sub = await Subscription.findOne({ companyId });
        const plan = getPlan(sub?.plan || 'FREE');
        const currentCount = await Client.countDocuments({ companyId });
        const remaining = plan.maxClients === Infinity ? Infinity : Math.max(0, plan.maxClients - currentCount);

        if (remaining === 0) {
            return res.status(403).json({
                status: 'error',
                limitReached: true,
                message: `Atingiste o limite de ${plan.maxClients} cliente(s) no plano ${plan.label}. Faz upgrade para importar mais.`,
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

        const created = [];
        const skipped = [];
        let remainingSlots = remaining;

        for (let i = 2; i <= ws.rowCount; i++) {
            const row = ws.getRow(i);
            const name = String(pickCell(row, 'nome (obrigatório)', 'nome', 'name') || '').trim();
            if (!name) continue;

            if (remainingSlots !== Infinity && remainingSlots <= 0) {
                skipped.push({ row: i, reason: `Limite do plano ${plan.label} atingido`, name });
                continue;
            }

            const nuit = String(pickCell(row, 'nuit') || '').trim();
            const nuitValid = nuit && nuit.toUpperCase() !== 'N/A';

            const dupQuery = nuitValid
                ? { companyId, nuit }
                : { companyId, name: new RegExp('^' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') };
            const existing = await Client.findOne(dupQuery).select('_id').lean();
            if (existing) {
                skipped.push({ row: i, reason: nuitValid ? `Já existe cliente com NUIT ${nuit}` : 'Já existe cliente com este nome', name });
                continue;
            }

            try {
                const client = await Client.create({
                    companyId,
                    name,
                    nuit: nuitValid ? nuit : undefined,
                    email: String(pickCell(row, 'email') || '').trim() || undefined,
                    phone: String(pickCell(row, 'telefone', 'phone') || '').trim() || undefined,
                    address: String(pickCell(row, 'endereço', 'endereco', 'address') || '').trim() || undefined,
                });
                created.push(client._id);
                if (remainingSlots !== Infinity) remainingSlots--;
            } catch (err) {
                skipped.push({ row: i, reason: err.message, name });
            }
        }

        logActivity({
            companyId: req.user.company._id, userId: req.user._id, userName: req.user.name,
            action: 'created', entity: 'client',
            description: `Importou ${created.length} cliente(s) via Excel.`
        });

        return res.json({
            status: 'success',
            created: created.length,
            skipped: skipped.length,
            details: skipped.slice(0, 20)
        });
    } catch (err) {
        console.error('[importClients]', err);
        return res.status(500).json({ status: 'error', message: 'Erro ao importar: ' + err.message });
    }
};
