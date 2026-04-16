#!/usr/bin/env node
/**
 * Envia email de anúncio do Programa de Indicações a todos os utilizadores activos
 * (empresa com subscrição activa, email verificado, não SUPERADMIN, status != blocked).
 *
 * Idempotente: marca user.referralsAnnouncedAt após envio e ignora quem já tenha.
 *
 * Flags:
 *   --dry-run            não envia, só lista
 *   --limit=N            processa no máximo N utilizadores
 *   --email=addr         restringe a um email específico (teste)
 *   --force              ignora referralsAnnouncedAt (reenvía)
 *
 * Exemplos:
 *   node scripts/send-referrals-announcement.js --dry-run
 *   node scripts/send-referrals-announcement.js --email=ismaeladicional@gmail.com
 *   node scripts/send-referrals-announcement.js --limit=5
 *   node scripts/send-referrals-announcement.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const FORCE = args.includes('--force');
const LIMIT = Number((args.find(a => a.startsWith('--limit=')) || '').split('=')[1]) || 0;
const ONLY_EMAIL = (args.find(a => a.startsWith('--email=')) || '').split('=')[1] || '';
const TEST_TO = (args.find(a => a.startsWith('--test-to=')) || '').split('=')[1] || '';

// Contas de teste/demo — nunca recebem o envio em massa
const EXCLUDED_EMAILS = [
    'demo@invoicing.bitiray.com',
    'l@gmail.com'
].map(e => e.toLowerCase());

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) { console.error('MONGODB_URI ausente'); process.exit(1); }

const APP_URL = (process.env.APP_URL || 'https://invoicing-h19p.onrender.com').replace(/\/$/, '');

const User = require('../src/models/user');
const Subscription = require('../src/models/subscription');
const { ensureCompanyReferralCode } = require('../src/utils/referralCode');
const { send } = require('../src/utils/mailSender');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function buildHtml(userName, referralLink, referralCode) {
    const cta = `
      <div style="text-align:center; margin:32px 0;">
        <a href="${APP_URL}/referrals"
           style="background:#228CDF; color:#fff; text-decoration:none; padding:14px 28px;
                  border-radius:6px; font-weight:700; display:inline-block;">
          Ver o meu link de indicações
        </a>
      </div>`;

    return `
<div style="background:#f4f6f8; padding:30px 0;">
  <div style="max-width:620px; margin:0 auto; background:#fff; border-radius:10px; padding:34px;
              font-family:Arial, Helvetica, sans-serif; color:#333; line-height:1.6;">

    <div style="text-align:center; font-size:2.4rem; margin-bottom:6px;">🎁</div>
    <h2 style="color:#228CDF; margin:0 0 8px; text-align:center; font-size:22px;">
      Novo: Programa de Indicações
    </h2>
    <p style="text-align:center; margin:0 0 24px; color:#555; font-size:15px;">
      Ganha <strong>+30 dias Premium grátis</strong> por cada empresa que indicares e pagar a primeira subscrição.
    </p>

    <p>Olá <strong>${userName || 'empresário(a)'}</strong>,</p>
    <p>
      Lançámos o <strong>Programa de Indicações</strong>. É a forma mais simples de prolongar a tua
      subscrição sem gastar nada — e ajudar colegas a descobrir o Invoicing.
    </p>

    <div style="background:#f8f9fc; border-left:4px solid #228CDF; border-radius:6px; padding:16px 18px; margin:20px 0;">
      <strong>Como funciona, em 3 passos:</strong>
      <ol style="padding-left:20px; margin:8px 0 0;">
        <li>Partilhas o teu link único com empresas que conheces.</li>
        <li>Elas registam-se e testam 30 dias grátis (normal para qualquer conta nova).</li>
        <li>Quando <strong>pagarem a primeira subscrição</strong>, ganhas <strong>30 dias de plano Premium</strong> — empilhados a seguir ao teu plano actual.</li>
      </ol>
    </div>

    <p style="margin:22px 0 6px;"><strong>O teu link único:</strong></p>
    <div style="background:#f1f3f9; border:1px dashed #bcc4d4; border-radius:6px; padding:12px 14px;
                font-family:monospace; font-size:13px; word-break:break-all; color:#2e3a59;">
      ${referralLink}
    </div>
    <p style="font-size:12px; color:#888; margin:6px 0 0;">Código: <strong>${referralCode}</strong></p>

    ${cta}

    <p style="color:#666; font-size:14px;">
      <strong>Sem limite de indicações.</strong> Indicas 5 empresas, ganhas 5 meses Premium.
      Indicas 12, ganhas 12. As regras completas estão em
      <a href="${APP_URL}/como-funciona-indicacoes" style="color:#228CDF;">como-funciona-indicacoes</a>.
    </p>

    <p style="margin-top:26px;">Obrigado por usares o Invoicing.<br><strong>Equipa Invoicing</strong></p>

    <hr style="margin-top:36px; border:none; border-top:1px solid #eee;" />
    <p style="font-size:12px; color:#999; text-align:center; margin:16px 0 0;">
      Este e-mail foi enviado automaticamente. Por favor, não respondas a esta mensagem.<br>
      <a href="${APP_URL}" style="color:#999;">${APP_URL.replace(/^https?:\/\//, '')}</a>
    </p>
  </div>
</div>`;
}

(async function main() {
    try {
        console.log('A conectar ao MongoDB de produção…');
        await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 10000 });

        // Modo de preview: envia 1 email para um endereço externo, sem tocar na BD.
        if (TEST_TO) {
            const previewCode = 'PREVIEW1';
            const previewLink = `${APP_URL}/register?ref=${previewCode}`;
            const html = buildHtml('Ismael (preview)', previewLink, previewCode);
            const subject = '[PREVIEW] Novo no Invoicing: ganha 30 dias Premium por cada indicação 🎁';
            console.log(`A enviar preview para ${TEST_TO}…`);
            await send(TEST_TO, subject, html);
            console.log('Preview enviado.');
            return;
        }

        const now = new Date();
        const activeSubs = await Subscription.find({
            status: 'active',
            expiresAt: { $gt: now }
        }).select('companyId').lean();
        const activeCompanyIds = activeSubs.map(s => s.companyId);
        console.log(`Subscrições activas: ${activeSubs.length}`);

        const userQuery = {
            companyId: { $in: activeCompanyIds },
            emailVerified: true,
            status: { $ne: 'blocked' },
            role: { $ne: 'SUPERADMIN' },
            email: { $exists: true, $ne: '' }
        };
        if (!FORCE) userQuery.referralsAnnouncedAt = { $in: [null, undefined] };
        if (ONLY_EMAIL) userQuery.email = ONLY_EMAIL;

        let users = await User.find(userQuery).select('_id name email companyId').lean();
        users = users.filter(u => !EXCLUDED_EMAILS.includes(String(u.email || '').toLowerCase()));
        if (LIMIT > 0) users = users.slice(0, LIMIT);

        console.log(`Utilizadores alvo: ${users.length}${DRY_RUN ? ' (DRY RUN)' : ''}`);
        if (!users.length) { console.log('Nada a fazer.'); return; }

        let sent = 0, failed = 0, skipped = 0;
        const subject = 'Novo no Invoicing: ganha 30 dias Premium por cada indicação 🎁';

        for (let i = 0; i < users.length; i++) {
            const u = users[i];
            try {
                const code = await ensureCompanyReferralCode(u.companyId);
                if (!code) { skipped++; console.log(`[${i + 1}/${users.length}] ${u.email} — sem código (skip)`); continue; }
                const link = `${APP_URL}/register?ref=${code}`;

                if (DRY_RUN) {
                    console.log(`[${i + 1}/${users.length}] would send → ${u.email} (code: ${code})`);
                } else {
                    const html = buildHtml(u.name || '', link, code);
                    await send(u.email, subject, html);
                    await User.updateOne({ _id: u._id }, { $set: { referralsAnnouncedAt: new Date() } });
                    sent++;
                    console.log(`[${i + 1}/${users.length}] enviado → ${u.email}`);
                    await sleep(250);
                }
            } catch (err) {
                failed++;
                console.error(`[${i + 1}/${users.length}] falha → ${u.email}: ${err.message}`);
            }
        }

        console.log('');
        console.log('=== Resumo ===');
        console.log(`Total alvo:  ${users.length}`);
        if (DRY_RUN) {
            console.log(`DRY RUN — nenhum email foi enviado.`);
        } else {
            console.log(`Enviados:    ${sent}`);
            console.log(`Falhas:      ${failed}`);
            console.log(`Saltados:    ${skipped}`);
        }
    } catch (err) {
        console.error('Erro fatal:', err);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
        console.log('Desligado.');
    }
})();
