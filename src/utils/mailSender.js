const nodemailer = require('nodemailer');
require('dotenv').config();

const APP_URL = process.env.APP_URL || 'https://invoicing-h19p.onrender.com';
const FROM = '"Invoicing" <invoicing@bitiray.com>';

function createTransporter() {
    return nodemailer.createTransport({
        host: 'smtp.hostinger.com',
        port: 465,
        secure: true,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });
}

function emailWrapper(content) {
    return `
<div style="background-color:#f4f6f8; padding:30px 0;">
  <div style="max-width:600px; margin:0 auto; background:#ffffff; border-radius:8px; padding:30px;
    font-family:Arial, Helvetica, sans-serif; color:#333; line-height:1.6;">
    ${content}
    <hr style="margin-top:40px; border:none; border-top:1px solid #eee;" />
    <p style="font-size:12px; color:#999; text-align:center;">
      Este e-mail foi enviado automaticamente. Por favor, não respondas a esta mensagem.<br>
      <a href="${APP_URL}" style="color:#999;">invoicing.bitiray.com</a>
    </p>
  </div>
</div>`;
}

function btn(text, url) {
    return `<div style="text-align:center; margin:30px 0;">
      <a href="${url}" style="background-color:#228CDF; color:#ffffff; text-decoration:none;
        padding:14px 28px; border-radius:6px; font-weight:bold; display:inline-block;">${text}</a>
    </div>`;
}

async function send(to, subject, html) {
    try {
        await createTransporter().sendMail({ from: FROM, to, subject, html });
        console.log(`[Mail] Enviado para ${to}: ${subject}`);
    } catch (err) {
        console.error(`[Mail] Erro ao enviar para ${to}:`, err.message);
    }
}

// ─── EMAIL DE BOAS-VINDAS COM TUTORIAL ────────────────────────────────────────
const sendWelcomeEmail = async (toEmail, userName) => {
    const html = emailWrapper(`
      <h2 style="color:#228CDF; margin-top:0; text-align:center;">Bem-vindo à Invoicing 🎉</h2>
      <p>Olá, <strong>${userName}</strong>,</p>
      <p>A tua conta foi criada com sucesso! Segue estes passos para começar:</p>
      <ol style="padding-left:18px;">
        <li><strong>Configura a tua empresa</strong> — vai às Configurações e adiciona o logotipo e dados bancários.</li>
        <li><strong>Adiciona os teus produtos ou serviços</strong> — em Produtos, cria o teu catálogo.</li>
        <li><strong>Regista os teus clientes</strong> — em Clientes, adiciona os contactos principais.</li>
        <li><strong>Emite o teu primeiro documento</strong> — Factura, VD ou Cotação em poucos cliques.</li>
      </ol>
      ${btn('Aceder à plataforma', APP_URL)}
      <div style="background:#f8f9fb; border-radius:6px; padding:20px;">
        <p style="margin:0;"><strong>Tens dúvidas?</strong> Contacta-nos em
          <a href="mailto:suporte@bitiray.com" style="color:#228CDF;">suporte@bitiray.com</a>
        </p>
      </div>
      <p style="margin-top:24px;">Com os melhores cumprimentos,<br><strong>Equipa Invoicing</strong></p>
    `);
    await send(toEmail, 'Bem-vindo à Invoicing — Primeiros passos', html);
};

// ─── AVISO DE EXPIRAÇÃO (7 DIAS) ──────────────────────────────────────────────
const sendExpiryWarningEmail = async (toEmail, userName, companyName, daysLeft, plan) => {
    const html = emailWrapper(`
      <h2 style="color:#e67e22; margin-top:0; text-align:center;">⚠️ A tua subscrição expira em breve</h2>
      <p>Olá, <strong>${userName}</strong>,</p>
      <p>A subscrição da empresa <strong>${companyName}</strong> (plano <strong>${plan}</strong>)
         expira em <strong>${daysLeft} dia(s)</strong>.</p>
      <p>Para não perderes o acesso à plataforma, renova o teu plano agora.</p>
      ${btn('Renovar Subscrição', `${APP_URL}/upgrade`)}
      <p><strong>Métodos de pagamento disponíveis:</strong></p>
      <ul style="padding-left:18px;">
        <li>M-Pesa: <strong>84 XXX XXXX</strong></li>
        <li>E-mola: <strong>86 XXX XXXX</strong></li>
        <li>Transferência bancária — NIB disponível na página de upgrade</li>
      </ul>
      <p>Após o pagamento, entra em contacto connosco para activarmos o teu plano.</p>
      <p>Com os melhores cumprimentos,<br><strong>Equipa Invoicing</strong></p>
    `);
    await send(toEmail, `⚠️ A tua subscrição expira em ${daysLeft} dia(s) — Renova agora`, html);
};

// ─── AVISO DE LIMITE A 80% ────────────────────────────────────────────────────
const sendLimitWarningEmail = async (toEmail, userName, companyName, resource, current, max, plan) => {
    const resourceLabels = {
        invoices: 'facturas este mês',
        sales: 'vendas este mês',
        clients: 'clientes',
        products: 'produtos',
    };
    const label = resourceLabels[resource] || resource;
    const html = emailWrapper(`
      <h2 style="color:#e67e22; margin-top:0; text-align:center;">⚡ Estás a aproximar-te do limite do teu plano</h2>
      <p>Olá, <strong>${userName}</strong>,</p>
      <p>A empresa <strong>${companyName}</strong> já utilizou <strong>${current} de ${max} ${label}</strong>
         no plano <strong>${plan}</strong>.</p>
      <p>Quando atingires o limite, não conseguirás criar novos registos. Faz upgrade agora para continuares sem interrupções.</p>
      ${btn('Ver Planos e Fazer Upgrade', `${APP_URL}/upgrade`)}
      <p>Com os melhores cumprimentos,<br><strong>Equipa Invoicing</strong></p>
    `);
    await send(toEmail, `⚡ Limite do plano a 80% — ${companyName}`, html);
};

// ─── RESUMO MENSAL ────────────────────────────────────────────────────────────
const sendMonthlySummaryEmail = async (toEmail, userName, companyName, stats) => {
    const month = new Date().toLocaleString('pt-PT', { month: 'long', year: 'numeric' });
    const html = emailWrapper(`
      <h2 style="color:#228CDF; margin-top:0; text-align:center;">📊 Resumo de ${month}</h2>
      <p>Olá, <strong>${userName}</strong>,</p>
      <p>Aqui está o resumo de actividade da empresa <strong>${companyName}</strong> este mês:</p>
      <table style="width:100%; border-collapse:collapse; margin:16px 0;">
        <tr style="background:#f8f9fb;">
          <td style="padding:10px 14px; border:1px solid #eee;"><strong>Facturas emitidas</strong></td>
          <td style="padding:10px 14px; border:1px solid #eee; text-align:right;">${stats.invoices ?? 0}</td>
        </tr>
        <tr>
          <td style="padding:10px 14px; border:1px solid #eee;"><strong>Vendas registadas</strong></td>
          <td style="padding:10px 14px; border:1px solid #eee; text-align:right;">${stats.sales ?? 0}</td>
        </tr>
        <tr style="background:#f8f9fb;">
          <td style="padding:10px 14px; border:1px solid #eee;"><strong>Total facturado</strong></td>
          <td style="padding:10px 14px; border:1px solid #eee; text-align:right;">${(stats.totalInvoiced ?? 0).toLocaleString('pt-MZ')} MZN</td>
        </tr>
        <tr>
          <td style="padding:10px 14px; border:1px solid #eee;"><strong>Total de vendas</strong></td>
          <td style="padding:10px 14px; border:1px solid #eee; text-align:right;">${(stats.totalSales ?? 0).toLocaleString('pt-MZ')} MZN</td>
        </tr>
        <tr style="background:#f8f9fb;">
          <td style="padding:10px 14px; border:1px solid #eee;"><strong>Novos clientes</strong></td>
          <td style="padding:10px 14px; border:1px solid #eee; text-align:right;">${stats.newClients ?? 0}</td>
        </tr>
      </table>
      ${btn('Ver Detalhes na Plataforma', `${APP_URL}/dashboard`)}
      <p>Com os melhores cumprimentos,<br><strong>Equipa Invoicing</strong></p>
    `);
    await send(toEmail, `📊 O teu resumo de ${month} — ${companyName}`, html);
};

// ─── PEDIDO DE UPGRADE (para o admin da plataforma) ───────────────────────────
const sendUpgradeRequestEmail = async ({ companyName, companyEmail, userName, plan, priceMZN, paymentMethod, paymentRef }) => {
    const adminEmail = process.env.ADMIN_EMAIL || process.env.EMAIL_USER;
    const html = emailWrapper(`
      <h2 style="color:#228CDF; margin-top:0;">Novo pedido de upgrade de plano</h2>
      <table style="width:100%; border-collapse:collapse; margin:16px 0;">
        <tr style="background:#f8f9fb;">
          <td style="padding:10px 14px; border:1px solid #eee;"><strong>Empresa</strong></td>
          <td style="padding:10px 14px; border:1px solid #eee;">${companyName}</td>
        </tr>
        <tr>
          <td style="padding:10px 14px; border:1px solid #eee;"><strong>Email</strong></td>
          <td style="padding:10px 14px; border:1px solid #eee;">${companyEmail}</td>
        </tr>
        <tr style="background:#f8f9fb;">
          <td style="padding:10px 14px; border:1px solid #eee;"><strong>Utilizador</strong></td>
          <td style="padding:10px 14px; border:1px solid #eee;">${userName}</td>
        </tr>
        <tr>
          <td style="padding:10px 14px; border:1px solid #eee;"><strong>Plano solicitado</strong></td>
          <td style="padding:10px 14px; border:1px solid #eee;">${plan} — ${priceMZN.toLocaleString('pt-MZ')} MZN/mês</td>
        </tr>
        <tr style="background:#f8f9fb;">
          <td style="padding:10px 14px; border:1px solid #eee;"><strong>Método de pagamento</strong></td>
          <td style="padding:10px 14px; border:1px solid #eee;">${paymentMethod}</td>
        </tr>
        <tr>
          <td style="padding:10px 14px; border:1px solid #eee;"><strong>Referência de pagamento</strong></td>
          <td style="padding:10px 14px; border:1px solid #eee;">${paymentRef}</td>
        </tr>
      </table>
      <p>Para activar o plano, vai ao painel de admin e usa o endpoint <code>PATCH /api/subscriptions/admin/activate</code>.</p>
    `);
    await send(adminEmail, `🆙 Pedido de upgrade — ${companyName} → ${plan}`, html);
};

// ─── CONFIRMAÇÃO DE UPGRADE (para o cliente) ──────────────────────────────────
const sendUpgradeConfirmationEmail = async (toEmail, userName, companyName, plan) => {
    const html = emailWrapper(`
      <h2 style="color:#27ae60; margin-top:0; text-align:center;">✅ Plano activado com sucesso!</h2>
      <p>Olá, <strong>${userName}</strong>,</p>
      <p>O plano <strong>${plan}</strong> da empresa <strong>${companyName}</strong> foi activado com sucesso!</p>
      <p>Já tens acesso a todas as funcionalidades do teu plano. Aproveita ao máximo.</p>
      ${btn('Aceder à plataforma', APP_URL)}
      <p>Obrigado por confiares na Invoicing.<br><strong>Equipa Invoicing</strong></p>
    `);
    await send(toEmail, `✅ Plano ${plan} activado — ${companyName}`, html);
};

module.exports = {
    sendWelcomeEmail,
    sendExpiryWarningEmail,
    sendLimitWarningEmail,
    sendMonthlySummaryEmail,
    sendUpgradeRequestEmail,
    sendUpgradeConfirmationEmail,
};
