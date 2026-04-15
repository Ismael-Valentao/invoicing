#!/usr/bin/env node
/**
 * Publica 4 releases na BD de produção.
 * Idempotente: ignora entradas cujo título já exista.
 *
 * Usar:  node scripts/publish-releases.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
    console.error('MONGODB_URI ausente no .env');
    process.exit(1);
}

const Release = require('../src/models/release');

const RELEASES = [
    {
        title: 'Novo: Programa de Indicações — ganha 30 dias Premium grátis',
        type: 'announcement',
        pinned: true,
        body: [
            'Podes agora convidar outras empresas para o Invoicing e ganhar **30 dias de plano Premium grátis** por cada indicação que pagar a primeira subscrição.',
            '',
            '- Sem limite de indicações: 5 convites = 5 meses Premium',
            '- Link único por empresa, pronto para partilhar no WhatsApp',
            '- Vê o teu link em **[Indicações](/referrals)** ou lê as regras em **[Como funciona](/como-funciona-indicacoes)**'
        ].join('\n'),
    },
    {
        title: 'Partilha facturas, cotações, recibos e VDs por WhatsApp',
        type: 'feature',
        pinned: false,
        body: [
            '- Novo botão verde "Partilhar por WhatsApp" em cada documento',
            '- Abre a conversa com o cliente com mensagem pré-formatada e link directo',
            '- Link público mostra o documento em browser, com botão de imprimir/PDF',
            '- **QR code** agora impresso em todas as facturas, cotações, recibos, VDs e notas de crédito/débito'
        ].join('\n'),
    },
    {
        title: 'Importar clientes e produtos por Excel + melhorias de sessão',
        type: 'improvement',
        pinned: false,
        body: [
            '- Nova funcionalidade: **Importar de Excel** em Clientes e Produtos, com template descarregável',
            '- Validação estrita de tipo e feedback visual imediato ao escolher ficheiro',
            '- Sessão de login passa de 1h para **24h** — menos logouts inesperados'
        ].join('\n'),
    },
    {
        title: 'Correcções gerais de UX',
        type: 'fix',
        pinned: false,
        body: [
            '- Modal "Adicionar produto" volta a notificar e recarregar a tabela após criação',
            '- Página de perfil carrega e permite alterar password',
            '- Dropdown do avatar no topbar volta a abrir em várias páginas',
            '- Ícones de Font Awesome carregam em conexões lentas (CDN fallback)'
        ].join('\n'),
    },
];

(async function main() {
    try {
        console.log('A conectar ao MongoDB de produção…');
        await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
        console.log('Ligado. A verificar duplicados…');

        const created = [];
        const skipped = [];

        // Ordem de inserção: fix, improvement, feature, announcement (último = publishedAt mais recente).
        // O announcement fica no topo por pinned=true.
        const ordered = [...RELEASES].reverse();

        for (const r of ordered) {
            const exists = await Release.findOne({ title: r.title }).select('_id').lean();
            if (exists) {
                skipped.push(r.title);
                continue;
            }
            const doc = await Release.create({
                title: r.title,
                body: r.body,
                type: r.type,
                pinned: r.pinned,
                authorName: 'Equipa Invoicing'
            });
            created.push({ id: doc._id.toString(), title: r.title, type: r.type, pinned: r.pinned });
        }

        console.log('');
        console.log('=== Resultado ===');
        console.log(`Criadas: ${created.length}`);
        created.forEach(c => console.log(`  + [${c.type}${c.pinned ? ', pinned' : ''}] ${c.title} (${c.id})`));
        if (skipped.length) {
            console.log(`Ignoradas (já existiam): ${skipped.length}`);
            skipped.forEach(t => console.log(`  - ${t}`));
        }
    } catch (err) {
        console.error('Erro:', err.message);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
        console.log('Desligado.');
    }
})();
