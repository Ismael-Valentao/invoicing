#!/usr/bin/env node
/**
 * Backfill: percorre as subscrições e envia o email de aviso/winback
 * apropriado para o estado actual (warning7d/3d/1d, expired1d/3d/7d).
 * Idempotente — usa Subscription.expiryNotifications para não repetir.
 *
 * Flags:
 *   --dry-run            não envia, só lista
 *   --limit=N            processa no máximo N subscrições
 *   --email=addr         restringe ao admin com este email (teste)
 *   --test-to=addr       envia 1 email de cada nível (3 warnings + 3 winbacks) só para este endereço, sem tocar na BD
 *   --force              ignora expiryNotifications (reenvía)
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const FORCE = args.includes('--force');
const LIMIT = Number((args.find(a => a.startsWith('--limit=')) || '').split('=')[1]) || 0;
const ONLY_EMAIL = (args.find(a => a.startsWith('--email=')) || '').split('=')[1] || '';
const TEST_TO = (args.find(a => a.startsWith('--test-to=')) || '').split('=')[1] || '';

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) { console.error('MONGODB_URI ausente'); process.exit(1); }

const Subscription = require('../src/models/subscription');
const User = require('../src/models/user');
require('../src/models/company'); // necessário para populate
const { getPlan } = require('../src/utils/plans');
const { sendExpiryWarningEmail, sendExpiredEmail } = require('../src/utils/mailSender');

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Contas de teste/demo — nunca recebem o envio em massa
const EXCLUDED_EMAILS = [
    'demo@invoicing.bitiray.com',
    'l@gmail.com'
].map(e => e.toLowerCase());

function pickWarningLevel(daysLeft) {
    if (daysLeft <= 1) return '1d';
    if (daysLeft <= 3) return '3d';
    if (daysLeft <= 7) return '7d';
    return null;
}
function pickExpiredLevel(daysExpired) {
    if (daysExpired >= 7) return '7d';
    if (daysExpired >= 3) return '3d';
    if (daysExpired >= 1) return '1d';
    return null;
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function runTestTo() {
    const fakeName = 'Ismael (preview)';
    const fakeCompany = 'Empresa de Teste';
    const fakePlan = 'Básico';
    console.log(`A enviar previews para ${TEST_TO}…`);
    for (const lvl of ['7d', '3d', '1d']) {
        const days = lvl === '1d' ? 1 : lvl === '3d' ? 3 : 7;
        await sendExpiryWarningEmail(TEST_TO, fakeName, fakeCompany, days, fakePlan, lvl);
    }
    for (const lvl of ['1d', '3d', '7d']) {
        await sendExpiredEmail(TEST_TO, fakeName, fakeCompany, fakePlan, lvl);
    }
    console.log('6 previews enviados (3 warnings + 3 winbacks).');
}

(async function main() {
    try {
        console.log('A conectar ao MongoDB de produção…');
        await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 10000 });

        if (TEST_TO) { await runTestTo(); return; }

        const now = new Date();
        const in7Days = new Date(now.getTime() + 7 * MS_PER_DAY);
        const minus7Days = new Date(now.getTime() - 7 * MS_PER_DAY);

        const subs = await Subscription.find({
            $or: [
                { status: 'active', expiresAt: { $gte: now, $lte: in7Days } },
                { status: 'expired', expiresAt: { $gte: minus7Days, $lt: now } }
            ]
        }).populate('companyId');

        console.log(`Subscrições candidatas: ${subs.length}`);

        const tasks = [];
        for (const sub of subs) {
            const company = sub.companyId;
            if (!company) continue;

            const adminUser = await User.findOne({ companyId: company._id, role: 'ADMIN' });
            if (!adminUser) continue;
            if (EXCLUDED_EMAILS.includes(String(adminUser.email || '').toLowerCase())) continue;
            if (ONLY_EMAIL && adminUser.email !== ONLY_EMAIL) continue;

            let level, kind, daysVal, fieldKey;
            if (sub.status === 'active') {
                daysVal = Math.ceil((sub.expiresAt - now) / MS_PER_DAY);
                level = pickWarningLevel(daysVal);
                if (!level) continue;
                kind = 'warning';
                fieldKey = `warning${level}`;
            } else {
                daysVal = Math.floor((now - sub.expiresAt) / MS_PER_DAY);
                level = pickExpiredLevel(daysVal);
                if (!level) continue;
                kind = 'expired';
                fieldKey = `expired${level}`;
            }

            const already = sub.expiryNotifications && sub.expiryNotifications[fieldKey];
            if (already && !FORCE) continue;

            tasks.push({ sub, company, adminUser, level, kind, daysVal, fieldKey });
        }

        const finalTasks = LIMIT > 0 ? tasks.slice(0, LIMIT) : tasks;
        console.log(`A processar: ${finalTasks.length}${DRY_RUN ? ' (DRY RUN)' : ''}`);
        if (!finalTasks.length) { console.log('Nada a fazer.'); return; }

        let sent = 0, failed = 0;
        for (let i = 0; i < finalTasks.length; i++) {
            const t = finalTasks[i];
            const tag = `[${i + 1}/${finalTasks.length}] ${t.kind}/${t.level} → ${t.adminUser.email}`;
            try {
                if (DRY_RUN) {
                    console.log(`${tag} (would send)`);
                    continue;
                }
                const planLabel = getPlan(t.sub.plan).label;
                if (t.kind === 'warning') {
                    await sendExpiryWarningEmail(t.adminUser.email, t.adminUser.name, t.company.name, t.daysVal, planLabel, t.level);
                } else {
                    await sendExpiredEmail(t.adminUser.email, t.adminUser.name, t.company.name, planLabel, t.level);
                }
                t.sub.expiryNotifications = t.sub.expiryNotifications || {};
                t.sub.expiryNotifications[t.fieldKey] = new Date();
                await t.sub.save();
                sent++;
                console.log(`${tag} (enviado)`);
                await sleep(250);
            } catch (err) {
                failed++;
                console.error(`${tag} FAILED: ${err.message}`);
            }
        }

        console.log('');
        console.log('=== Resumo ===');
        console.log(`Enviados: ${sent}, Falhas: ${failed}, ${DRY_RUN ? '(dry run)' : ''}`);
    } catch (err) {
        console.error('Erro fatal:', err);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
        console.log('Desligado.');
    }
})();
