/**
 * Seed de releases para o /whats-new em PRODUÇÃO.
 *
 * Idempotente — usa upsert por `title`. Corres as vezes que quiseres, só
 * actualiza os campos em vez de duplicar.
 *
 * Uso:
 *   node scripts/seed-releases.js
 *
 * Usa MONGODB_URI do .env (produção).
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Release = require('../src/models/release');

const MONGO_URI = process.env.MONGODB_URI;
if (!MONGO_URI) {
    console.error('MONGODB_URI não definido no .env');
    process.exit(1);
}

const RELEASES = [
    {
        title: 'Prazo de validade e alertas de vencimento',
        version: 'v2.2',
        type: 'feature',
        pinned: true,
        publishedAt: new Date('2026-04-10T09:00:00Z'),
        authorName: 'Equipa Invoicing',
        body: `Passa a ser possível registar o <strong>prazo de validade</strong> de cada produto e o número de dias de antecedência para o alerta.

O sistema gera automaticamente <strong>notificações</strong> quando um produto está prestes a vencer ou já venceu, e o dashboard mostra um quadro com os produtos a precisar de atenção.

Adicionalmente, no POS, ao confirmar uma venda, passa a ver de imediato <strong>quanto stock ficou</strong> de cada produto vendido.`
    },
    {
        title: 'Pesquisa global com Ctrl+K',
        version: 'v2.1',
        type: 'feature',
        pinned: false,
        publishedAt: new Date('2026-04-08T12:00:00Z'),
        authorName: 'Equipa Invoicing',
        body: `Em qualquer página do sistema, carrega <strong>Ctrl+K</strong> (ou Cmd+K no Mac) e começa a escrever. A pesquisa percorre em simultâneo:

• Facturas pelo número ou nome do cliente
• Clientes por nome, NUIT ou email
• Produtos por descrição, SKU ou código de barras
• Vendas pelo número do recibo

Usa as setas do teclado para navegar e Enter para abrir. Desenhado para quem trabalha rápido e não quer perder tempo a navegar pelos menus.`
    },
    {
        title: 'App instalável e POS offline',
        version: 'v2.0',
        type: 'feature',
        pinned: false,
        publishedAt: new Date('2026-04-05T10:00:00Z'),
        authorName: 'Equipa Invoicing',
        body: `O Invoicing passa a ser uma <strong>Progressive Web App</strong>: podes instalá-lo como aplicação no telemóvel ou computador sem precisar de passar pela Play Store.

<strong>POS offline:</strong> as vendas feitas quando não há internet são guardadas localmente e enviadas automaticamente assim que a ligação voltar. Zero vendas perdidas, mesmo em zonas com cobertura instável.`
    },
    {
        title: 'Análise de margem por produto',
        version: 'v1.9',
        type: 'improvement',
        pinned: false,
        publishedAt: new Date('2026-04-02T14:00:00Z'),
        authorName: 'Equipa Invoicing',
        body: `Nova página <strong>Relatórios → Margem por produto</strong> que mostra, para cada item do teu catálogo, a margem em valor e em percentagem, o valor do stock actual e o lucro potencial.

Agora que existe o campo de preço de compra no cadastro de produtos, o sistema consegue calcular o custo médio ponderado em cada entrada de stock e apresentar uma visão clara de quais produtos geram mais lucro.`
    },
    {
        title: 'Distinção entre produto e serviço',
        version: 'v1.8',
        type: 'improvement',
        pinned: false,
        publishedAt: new Date('2026-03-28T09:00:00Z'),
        authorName: 'Equipa Invoicing',
        body: `Passa a ser possível classificar cada item como <strong>Produto</strong> (com controlo de stock) ou <strong>Serviço</strong> (sem stock — para consultoria, mão-de-obra, transporte, etc).

Facturas com itens ligados a produtos passam a dar baixa automática no inventário. Serviços são ignorados no controlo de stock.`
    },
];

async function run() {
    console.log('[seed] A ligar ao MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('[seed] Ligado.');

    let created = 0, updated = 0;
    for (const r of RELEASES) {
        const existing = await Release.findOne({ title: r.title });
        if (existing) {
            Object.assign(existing, r);
            await existing.save();
            updated++;
            console.log(`  ↻ actualizado: "${r.title}"`);
        } else {
            await Release.create(r);
            created++;
            console.log(`  ✓ criado: "${r.title}"`);
        }
    }

    console.log(`\n[seed] Feito. Criados: ${created}, actualizados: ${updated}.`);
    await mongoose.disconnect();
}

run().catch(err => {
    console.error('[seed] Erro:', err);
    process.exit(1);
});