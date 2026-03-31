/**
 * Script de migração: actualiza todos os números de documentos existentes
 * para o novo formato "SIGLA ANO_CURTO/NÚMERO" (Opção C).
 *
 * Exemplos:
 *   FT 26/0001, CT 26/0001, VD 26/0001, RC 26/0001, RV 26/0001
 *
 * Uso:
 *   node scripts/migrate-doc-numbers.js
 *
 * O script:
 *  1. Lê todos os documentos de cada tipo, agrupados por empresa e ano
 *  2. Ordena por data de criação (mais antigo primeiro)
 *  3. Atribui números sequenciais no novo formato
 *  4. Actualiza os counters para continuar a partir do último número
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Invoice = require('../src/models/invoice');
const Recibo = require('../src/models/recibo');
const Sale = require('../src/models/sale');
const Counter = require('../src/models/counter');

const mongoURI = process.env.MONGODB_URI;

function buildNumber(prefix, year, seq) {
    const y = String(year).slice(-2);
    const n = String(seq).padStart(4, '0');
    return `${prefix} ${y}/${n}`;
}

async function migrateCollection({ model, filter, numberField, prefix, counterType, label }) {
    const docs = await model.find(filter).sort({ createdAt: 1 });

    if (!docs.length) {
        console.log(`  [${label}] Sem documentos para migrar.`);
        return;
    }

    // Group by companyId + year
    const groups = {};
    for (const doc of docs) {
        const companyId = String(doc.companyId);
        const year = new Date(doc.createdAt).getFullYear();
        const key = `${companyId}__${year}`;
        if (!groups[key]) groups[key] = { companyId, year, docs: [] };
        groups[key].docs.push(doc);
    }

    let totalUpdated = 0;

    for (const group of Object.values(groups)) {
        let seq = 0;
        for (const doc of group.docs) {
            seq++;
            const newNumber = buildNumber(prefix, group.year, seq);
            const oldNumber = doc[numberField];

            if (oldNumber !== newNumber) {
                doc[numberField] = newNumber;
                await doc.save();
                totalUpdated++;
            }
        }

        // Update counter so future numbers continue from here
        const counterKey = `${counterType}_${group.year}`;
        await Counter.findOneAndUpdate(
            { companyId: group.companyId, type: counterKey },
            { $set: { value: seq } },
            { upsert: true }
        );
    }

    console.log(`  [${label}] ${totalUpdated} de ${docs.length} documentos actualizados.`);
}

async function main() {
    console.log('Conectando à base de dados...');
    await mongoose.connect(mongoURI);
    console.log('Conectado.\n');

    console.log('=== MIGRAÇÃO DE SÉRIES DE DOCUMENTOS ===\n');

    // 1. Facturas (Invoice model, docType: invoice)
    console.log('1. Facturas (FT):');
    await migrateCollection({
        model: Invoice,
        filter: { docType: 'invoice' },
        numberField: 'invoiceNumber',
        prefix: 'FT',
        counterType: 'invoice',
        label: 'Facturas'
    });

    // 2. Cotações (Invoice model, docType: quotation) — stored in Invoice model
    //    Check if quotations use Invoice model or separate Quotation model
    let QuotationModel;
    try {
        QuotationModel = require('../src/models/quotation');
    } catch (e) {
        QuotationModel = null;
    }

    console.log('2. Cotações (CT):');
    if (QuotationModel) {
        await migrateCollection({
            model: QuotationModel,
            filter: {},
            numberField: 'quotationNumber',
            prefix: 'CT',
            counterType: 'quotation',
            label: 'Cotações (modelo próprio)'
        });
    }
    // Also check Invoice model for docType quotation
    const quotInInvoice = await Invoice.countDocuments({ docType: 'quotation' });
    if (quotInInvoice > 0) {
        await migrateCollection({
            model: Invoice,
            filter: { docType: 'quotation' },
            numberField: 'invoiceNumber',
            prefix: 'CT',
            counterType: 'quotation',
            label: 'Cotações (no modelo Invoice)'
        });
    }

    // 3. VDs (Invoice model, docType: vd)
    console.log('3. VDs (VD):');
    await migrateCollection({
        model: Invoice,
        filter: { docType: 'vd' },
        numberField: 'invoiceNumber',
        prefix: 'VD',
        counterType: 'vd',
        label: 'VDs'
    });

    // 4. Recibos
    console.log('4. Recibos (RC):');
    await migrateCollection({
        model: Recibo,
        filter: {},
        numberField: 'reciboNumber',
        prefix: 'RC',
        counterType: 'recibo',
        label: 'Recibos'
    });

    // 5. Vendas (receiptNumber)
    console.log('5. Recibos de Venda (RV):');
    await migrateCollection({
        model: Sale,
        filter: {},
        numberField: 'receiptNumber',
        prefix: 'RV',
        counterType: 'saleReceipt',
        label: 'Vendas'
    });

    console.log('\n=== MIGRAÇÃO CONCLUÍDA ===');
    console.log('Os counters foram actualizados para continuar a partir dos últimos números.\n');

    await mongoose.disconnect();
    process.exit(0);
}

main().catch(err => {
    console.error('ERRO:', err);
    process.exit(1);
});
