const puppeteer = require("puppeteer");
const { formatedDate } = require("./dateFormatter");
require("dotenv").config();
const PDFDocument = require("pdfkit");
const QRCode = require("qrcode");

const logoPath = process.env.LOGO_PATH || "https://bitiray.com/public/invoicing-logos/";

function mmToPt(mm) {
  return (mm * 72) / 25.4;
}

function formatCurrency(value, showCurrencyCode = false) {
  const formatted = new Intl.NumberFormat("pt-MZ", {
    style: "currency",
    currency: "MZN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

  return showCurrencyCode
    ? formatted.replace("MTn", "MZN")
    : formatted.replace("MTn", "");
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getPrimaryBank(companyInfo) {
  const banks = Array.isArray(companyInfo?.bankDetails)
    ? companyInfo.bankDetails
    : companyInfo?.bankDetails
      ? [companyInfo.bankDetails]
      : [];

  return banks.find((b) => b?.isPrimary) || banks[0] || null;
}

function renderBankDetailsBlock(companyInfo, documentType) {
  const visibilityMap = {
    invoice: companyInfo?.showBankDetails?.invoices,
    quotation: companyInfo?.showBankDetails?.quotations,
    vd: companyInfo?.showBankDetails?.vds,
    receipt: companyInfo?.showBankDetails?.receipts,
  };

  if (!visibilityMap[documentType]) return "";

  const banks = Array.isArray(companyInfo?.bankDetails)
    ? companyInfo.bankDetails.filter(Boolean)
    : companyInfo?.bankDetails
      ? [companyInfo.bankDetails]
      : [];

  if (!banks.length) return "";

  return `
    <div class="bank-box">
      <div class="bank-title">Dados bancários para pagamento</div>
      <div class="bank-list">
        ${banks.map((bank) => `
          <div class="bank-item">
            <div class="bank-item-header">
              <span class="bank-item-name">
                ${escapeHtml(bank.label || bank.bank || "Conta bancária")}
              </span>
              ${bank.isPrimary ? `<span class="bank-primary-badge">Principal</span>` : ""}
            </div>

            <div class="bank-grid">
              <div><strong>Banco:</strong> ${escapeHtml(bank.bank || "-")}</div>
              <div><strong>Titular:</strong> ${escapeHtml(bank.account_name || "-")}</div>
              <div><strong>Nº da Conta:</strong> ${escapeHtml(bank.account_number || "-")}</div>
              <div><strong>NIB:</strong> ${escapeHtml(bank.nib || "-")}</div>
              ${bank.nuib ? `<div><strong>NUIB:</strong> ${escapeHtml(bank.nuib)}</div>` : ""}
            </div>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

function renderItemsTable(items = []) {
  return `
    <table>
      <thead>
        <tr>
          <th>Descrição</th>
          <th class="text-center">Quantidade</th>
          <th class="text-center">Preço Unitário</th>
          <th class="text-right">Total</th>
        </tr>
      </thead>
      <tbody>
        ${items
      .map(
        (item) => `
          <tr>
            <td>${escapeHtml(item.description || item.name || "-")}</td>
            <td class="text-center">${Number(item.quantity || 0)}</td>
            <td class="text-center">${formatCurrency(item.unitPrice ?? item.price ?? 0)}</td>
            <td class="text-right">${formatCurrency(
          Number(item.quantity || 0) * Number(item.unitPrice ?? item.price ?? 0)
        )}</td>
          </tr>
        `
      )
      .join("")}
      </tbody>
    </table>
  `;
}

function renderTotalsTable(doc) {
  return `
    <table class="totals-table">
      <tbody>
        <tr>
          <td>Sub-Total</td>
          <td class="text-right">${formatCurrency(doc.subTotal)}</td>
        </tr>
        <tr>
          <td>IVA (${Number(doc.appliedTax || 0) * 100}%)</td>
          <td class="text-right">${formatCurrency(doc.tax)}</td>
        </tr>
        <tr class="grand-total">
          <td>Total</td>
          <td class="text-right">${formatCurrency(doc.totalAmount, true)}</td>
        </tr>
      </tbody>
    </table>
  `;
}

function buildA4DocumentHtml({
  companyInfo,
  title,
  docNumberLabel,
  docNumber,
  date,
  clientName,
  clientNUIT,
  items,
  totals,
  footerNotes = [],
  bankBlock = "",
  qrCodeDataUrl = "",
}) {
  const logoSrc = companyInfo.logoUrl
    ? logoPath + companyInfo.logoUrl
    : logoPath + "logo-default.png";

  return `
  <html lang="pt">
  <head>
    <meta charset="utf-8" />
    <style>
      * {
        box-sizing: border-box;
      }

      body {
        font-family: Helvetica, Arial, sans-serif;
        margin: 0;
        padding: 0;
        color: #1f2937;
        background: #ffffff;
      }

      .page {
    width: 794px;
    min-height: 1123px;
    margin: 0 auto;
    padding: 34px 34px 24px 34px;
    background: white;

    display: flex;
    flex-direction: column;
}

      .top-band {
        height: 8px;
        background: linear-gradient(90deg, #1d4ed8, #3b82f6);
        border-radius: 999px;
        margin-bottom: 24px;
      }

      .header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 20px;
        margin-bottom: 24px;
      }

      .logo-wrap img {
        max-width: 190px;
        max-height: 84px;
        object-fit: contain;
      }

      .company-info {
        text-align: right;
        font-size: 12px;
        max-width: 320px;
      }

      .company-info p {
        margin: 0 0 5px 0;
      }

      .company-info .company-name {
        font-size: 16px;
        font-weight: 800;
        color: #111827;
      }

      .doc-title-wrap {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 18px;
        margin-bottom: 22px;
        padding: 14px 16px;
        background: #f8fafc;
        border: 1px solid #e5e7eb;
        border-radius: 14px;
      }

      .doc-title {
        font-size: 22px;
        font-weight: 800;
        letter-spacing: .04em;
        color: #111827;
        margin: 0 0 6px 0;
      }

      .doc-subtitle {
        font-size: 12px;
        color: #6b7280;
        margin: 0;
      }

      .doc-meta {
        text-align: right;
        font-size: 12px;
      }

      .doc-meta p {
        margin: 0 0 5px 0;
      }

      .client-box {
        display: flex;
        justify-content: space-between;
        gap: 18px;
        margin-bottom: 18px;
      }

      .client-card {
        flex: 1;
        border: 1px solid #e5e7eb;
        border-radius: 14px;
        padding: 14px 16px;
        background: #fff;
      }

      .section-label {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: .06em;
        color: #6b7280;
        font-weight: 800;
        margin-bottom: 8px;
      }

      .client-card p {
        margin: 0 0 6px 0;
        font-size: 12px;
      }

      table {
        width: 100%;
        border-collapse: collapse;
      }

      thead th {
        background: #eff6ff;
        color: #1e3a8a;
        border-bottom: 2px solid #bfdbfe;
        font-size: 12px;
        font-weight: 800;
        padding: 10px 8px;
      }

      tbody td {
        border-bottom: 1px solid #e5e7eb;
        padding: 10px 8px;
        font-size: 12px;
        vertical-align: top;
      }

      .text-center {
        text-align: center !important;
      }

      .text-right {
        text-align: right !important;
      }

      .totals-wrap {
        display: flex;
        justify-content: flex-end;
        margin-top: 14px;
      }

      .totals-table {
        width: 320px;
        border: 1px solid #e5e7eb;
        border-radius: 12px;
        overflow: hidden;
      }

      .totals-table td {
        padding: 10px 12px;
        font-size: 12px;
        border-bottom: 1px solid #e5e7eb;
      }

      .totals-table tr:last-child td {
        border-bottom: none;
      }

      .totals-table .grand-total td {
        background: #111827;
        color: white;
        font-size: 14px;
        font-weight: 800;
      }

      .bank-box {
        margin-top: 18px;
        padding: 14px 16px;
        border: 1px solid #dbeafe;
        background: #f8fbff;
        border-radius: 14px;
      }

      .bank-title {
        font-size: 12px;
        font-weight: 800;
        color: #1d4ed8;
        margin-bottom: 10px;
      }

      .bank-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px 18px;
        font-size: 12px;
      }

      .content {
    flex: 1;
}

.footer-notes {
    margin-top: 20px;
    padding-top: 12px;
    border-top: 1px dashed #cbd5e1;

    font-size: 11px;
    color: #4b5563;
}

      .footer-notes p {
        margin: 0 0 6px 0;
        font-size: 11px;
        color: #4b5563;
      }

            .bank-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .bank-item {
        border: 1px solid #dbeafe;
        background: #ffffff;
        border-radius: 12px;
        padding: 12px;
      }

      .bank-item-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 10px;
        margin-bottom: 8px;
      }

      .bank-item-name {
        font-size: 12px;
        font-weight: 800;
        color: #111827;
      }

      .bank-primary-badge {
        display: inline-block;
        padding: 3px 8px;
        font-size: 10px;
        font-weight: 800;
        color: #166534;
        background: #dcfce7;
        border-radius: 999px;
        white-space: nowrap;
      }
    </style>
  </head>
  <body>
    <div class="page">
    <div class="content">
      <div class="top-band"></div>

      <div class="header">
        <div class="logo-wrap">
          <img src="${logoSrc}" alt="logo" />
        </div>

        <div class="company-info">
          <p class="company-name">${escapeHtml(companyInfo.name || "-")}</p>
          <p>${escapeHtml(companyInfo.address || "")}</p>
          <p><strong>Contacto:</strong> ${escapeHtml(companyInfo.contact || "-")}</p>
          <p><strong>Email:</strong> ${escapeHtml(companyInfo.email || "-")}</p>
          <p><strong>NUIT:</strong> ${escapeHtml(companyInfo.nuit || "-")}</p>
        </div>
      </div>

      <div class="doc-title-wrap">
        <div>
          <h1 class="doc-title">${escapeHtml(title)}</h1>
          <p class="doc-subtitle">Documento emitido automaticamente por computador</p>
        </div>

        <div class="doc-meta">
          <p><strong>${escapeHtml(docNumberLabel)}:</strong> ${escapeHtml(docNumber || "-")}</p>
          <p><strong>Data:</strong> ${escapeHtml(formatedDate(date))}</p>
        </div>
      </div>

      <div class="client-box">
        <div class="client-card">
          <div class="section-label">Cliente</div>
          <p><strong>Nome:</strong> ${escapeHtml(clientName || "-")}</p>
          <p><strong>NUIT:</strong> ${escapeHtml(clientNUIT || "-")}</p>
        </div>
      </div>

      ${renderItemsTable(items)}

      <div class="totals-wrap">
        ${renderTotalsTable(totals)}
      </div>

      ${bankBlock}

      ${qrCodeDataUrl ? `
      <div style="text-align:center; margin-top:14px;">
        <img src="${qrCodeDataUrl}" style="width:80px; height:80px;" />
        <p style="font-size:7px; color:#858796; margin-top:2px;">Digitalize para ver este documento online</p>
      </div>
      ` : ''}
        </div>
      <div class="footer-notes">
        ${footerNotes.map((note) => `<p>${escapeHtml(note)}</p>`).join("")}
      </div>
    </div>
  </body>
  </html>
  `;
}

async function renderA4Pdf(html) {
  const browserArgs =
    process.env.NODE_ENV.toLowerCase() === "production"
      ? ["--no-sandbox", "--disable-setuid-sandbox", "--no-zygote", "--single-process"]
      : ["--no-sandbox", "--disable-setuid-sandbox"];

  const browser = await puppeteer.launch({
    headless: "new",
    args: browserArgs,
  });

  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle0", timeout: 0 });

  const pdfBuffer = await page.pdf({
    format: "A4",
    printBackground: true,
    margin: {
      top: "12mm",
      right: "12mm",
      bottom: "12mm",
      left: "12mm",
    },
  });

  await browser.close();
  return pdfBuffer;
}

async function generateInvoicePDF(companyInfo, invoice) {
  // Generate QR code linking to the client portal
  let qrCodeDataUrl = "";
  try {
    const baseUrl = process.env.BASE_URL || "https://invoicing.bitiray.com";
    const portalUrl = `${baseUrl}/p/${invoice._id}`;
    qrCodeDataUrl = await QRCode.toDataURL(portalUrl, { width: 120, margin: 1 });
  } catch (e) { /* QR code is optional */ }

  const html = buildA4DocumentHtml({
    companyInfo,
    title: "FACTURA",
    docNumberLabel: "Factura Nº",
    docNumber: invoice.invoiceNumber,
    date: invoice.date,
    clientName: invoice.clientName,
    clientNUIT: invoice.clientNUIT,
    items: invoice.items || [],
    totals: {
      subTotal: invoice.subTotal,
      appliedTax: invoice.appliedTax,
      tax: invoice.tax,
      totalAmount: invoice.totalAmount,
    },
    bankBlock: renderBankDetailsBlock(companyInfo, "invoice"),
    qrCodeDataUrl,
    footerNotes: [
      "Este documento serve como comprovativo da prestação de serviços e/ou fornecimento de bens.",
      `Em caso de dúvidas, contacte o departamento financeiro: ${companyInfo.email || "-"} | ${companyInfo.contact || "-"}`,
    ],
  });

  return await renderA4Pdf(html);
}

async function generateQuotationPDF(companyInfo, quotation) {
  const html = buildA4DocumentHtml({
    companyInfo,
    title: "COTAÇÃO",
    docNumberLabel: "Cotação Nº",
    docNumber: quotation.quotationNumber,
    date: quotation.date,
    clientName: quotation.clientName,
    clientNUIT: quotation.clientNUIT,
    items: quotation.items || [],
    totals: {
      subTotal: quotation.subTotal,
      appliedTax: quotation.appliedTax,
      tax: quotation.tax,
      totalAmount: quotation.totalAmount,
    },
    bankBlock: renderBankDetailsBlock(companyInfo, "quotation"),
    footerNotes: [
      "Esta cotação representa uma proposta comercial de fornecimento de bens e/ou serviços.",
      `Em caso de dúvidas, contacte o departamento financeiro: ${companyInfo.email || "-"} | ${companyInfo.contact || "-"}`,
    ],
  });

  return await renderA4Pdf(html);
}

async function generateVDPDF(companyInfo, vd) {
  const html = buildA4DocumentHtml({
    companyInfo,
    title: "VENDA A DINHEIRO",
    docNumberLabel: "VD Nº",
    docNumber: vd.invoiceNumber,
    date: vd.date,
    clientName: vd.clientName,
    clientNUIT: vd.clientNUIT,
    items: vd.items || [],
    totals: {
      subTotal: vd.subTotal,
      appliedTax: vd.appliedTax,
      tax: vd.tax,
      totalAmount: vd.totalAmount,
    },
    bankBlock: renderBankDetailsBlock(companyInfo, "vd"),
    footerNotes: [
      "Este documento comprova o pagamento imediato dos bens ou serviços descritos acima.",
      "Não necessita de factura adicional. Conserve este documento como comprovativo legal.",
      `Emitido por: ${companyInfo.name || "-"} | Contacto: ${companyInfo.contact || "-"}`,
    ],
  });

  return await renderA4Pdf(html);
}

async function generateReciboPDF(companyInfo, invoice) {
  const html = buildA4DocumentHtml({
    companyInfo,
    title: "RECIBO",
    docNumberLabel: "Recibo Nº",
    docNumber: invoice.reciboNumber,
    date: invoice.date,
    clientName: invoice.clientName,
    clientNUIT: invoice.clientNUIT,
    items: invoice.items || [],
    totals: {
      subTotal: invoice.subTotal,
      appliedTax: invoice.appliedTax,
      tax: invoice.tax,
      totalAmount: invoice.totalAmount,
    },
    bankBlock: renderBankDetailsBlock(companyInfo, "receipt"),
    footerNotes: [
      "Este recibo confirma o pagamento referente aos bens ou serviços descritos acima.",
      `Data do pagamento: ${formatedDate(new Date().toISOString())}`,
      `Emitido por: ${companyInfo.name || "-"} | Contacto: ${companyInfo.contact || "-"}`,
    ],
  });

  return await renderA4Pdf(html);
}

// =========================
// RECIBO TÉRMICO
// =========================

function calcHeight(doc, blocks, contentWidth) {
  let h = 0;

  for (const b of blocks) {
    if (b.type === "gap") {
      doc.font("Courier").fontSize(b.fontSize || 9);
      h += (b.lines || 0) * doc.currentLineHeight(true);
      continue;
    }

    if (b.type === "line" || b.type === "text") {
      doc.font("Courier").fontSize(b.fontSize || 9);
      h += doc.heightOfString(b.text, {
        width: contentWidth,
        align: b.align || "left",
      });
      continue;
    }

    if (b.type === "row") {
      doc.font("Courier").fontSize(b.fontSize || 9);
      h += doc.currentLineHeight(true);
    }
  }

  return h;
}

function buildReceiptBlocks(companyInfo, sale) {
  const receiptNo = sale.receiptNumber || String(sale._id);
  const dateStr = new Date(sale.createdAt || Date.now()).toLocaleString("pt-MZ");
  const operator = sale.operatorName || "Sistema";
  const dash = "----------------------------------------";

  const blocks = [];

  blocks.push({ type: "text", text: companyInfo.name || "-", fontSize: 12, align: "center" });
  blocks.push({ type: "text", text: companyInfo.address || "", fontSize: 9, align: "center" });
  blocks.push({ type: "text", text: `Tel: ${companyInfo.contact || "-"}`, fontSize: 9, align: "center" });
  blocks.push({ type: "text", text: `NUIT: ${companyInfo.nuit || "-"}`, fontSize: 9, align: "center" });

  blocks.push({ type: "gap", lines: 0.4, fontSize: 9 });
  blocks.push({ type: "line", text: dash, fontSize: 9, align: "center" });

  blocks.push({ type: "text", text: `Recibo Nº: ${receiptNo}`, fontSize: 9 });
  blocks.push({ type: "text", text: `Data: ${dateStr}`, fontSize: 9 });
  blocks.push({ type: "text", text: `Operador: ${operator}`, fontSize: 9 });

  blocks.push({ type: "gap", lines: 0.4, fontSize: 9 });
  blocks.push({ type: "line", text: dash, fontSize: 9, align: "center" });

  for (const item of sale.items || []) {
    blocks.push({ type: "text", text: item.description || item.name || "Produto", fontSize: 9 });
    blocks.push({ type: "row", fontSize: 9 });
    blocks.push({ type: "gap", lines: 0.2, fontSize: 9 });
  }

  blocks.push({ type: "line", text: dash, fontSize: 9, align: "center" });
  blocks.push({ type: "row", fontSize: 11 });
  blocks.push({ type: "row", fontSize: 9 });
  blocks.push({ type: "row", fontSize: 9 });
  blocks.push({ type: "gap", lines: 0.4, fontSize: 9 });
  blocks.push({ type: "line", text: dash, fontSize: 9, align: "center" });

  blocks.push({ type: "text", text: "Obrigado pela preferência!", fontSize: 9, align: "center" });
  blocks.push({ type: "text", text: "Volte sempre", fontSize: 9, align: "center" });

  return blocks;
}

function renderReceipt(doc, companyInfo, sale, contentWidth) {
  const receiptNo = sale.receiptNumber || String(sale._id);
  const dateStr = new Date(sale.createdAt || Date.now()).toLocaleString("pt-MZ");
  const operator = sale.operatorName || "Sistema";
  const dash = "----------------------------------------";

  doc.font("Courier");

  doc.fontSize(12).text(companyInfo.name || "-", { align: "center", width: contentWidth });
  doc.fontSize(9).text(companyInfo.address || "", { align: "center", width: contentWidth });
  doc.text(`Tel: ${companyInfo.contact || "-"}`, { align: "center", width: contentWidth });
  doc.text(`NUIT: ${companyInfo.nuit || "-"}`, { align: "center", width: contentWidth });

  doc.moveDown(0.4);
  doc.text(dash, { align: "center", width: contentWidth });

  doc.text(`Recibo Nº: ${receiptNo}`, { width: contentWidth });
  doc.text(`Data: ${dateStr}`, { width: contentWidth });
  doc.text(`Operador: ${operator}`, { width: contentWidth });

  doc.moveDown(0.4);
  doc.text(dash, { align: "center", width: contentWidth });

  for (const item of sale.items || []) {
    const name = item.name || item.description || "Produto";
    const qty = Number(item.quantity || 0);
    const price = Number(item.price ?? item.unitPrice ?? 0);

    doc.fontSize(9).text(name, { width: contentWidth });
    doc.text(`${qty} x ${formatCurrency(price)}`, { continued: true, width: contentWidth });
    doc.text(`${formatCurrency(qty * price)}`, { align: "right" });
    doc.moveDown(0.2);
  }

  doc.text(dash, { align: "center", width: contentWidth });

  doc.fontSize(11).text("TOTAL", { continued: true, width: contentWidth });
  doc.text(formatCurrency(sale.total), { align: "right" });

  doc.fontSize(9).text("Pago", { continued: true, width: contentWidth });
  doc.text(formatCurrency(sale.paidAmount ?? sale.total), { align: "right" });

  doc.text("Troco", { continued: true, width: contentWidth });
  doc.text(formatCurrency((sale.paidAmount ?? sale.total) - sale.total), { align: "right" });

  doc.moveDown(0.4);
  doc.text(dash, { align: "center", width: contentWidth });

  doc.text("Obrigado pela preferência!", { align: "center", width: contentWidth });
  doc.text("Volte sempre", { align: "center", width: contentWidth });
}

async function generateSaleReceiptPDFKit(companyInfo, sale) {
  const pageWidthPt = mmToPt(80);
  const margins = {
    top: mmToPt(5),
    bottom: mmToPt(5),
    left: mmToPt(5),
    right: mmToPt(5),
  };

  const contentWidth = pageWidthPt - margins.left - margins.right;

  const measureDoc = new PDFDocument({ autoFirstPage: false });
  measureDoc.addPage({ size: [pageWidthPt, mmToPt(200)], margins });

  const blocks = buildReceiptBlocks(companyInfo, sale);
  const contentHeight = calcHeight(measureDoc, blocks, contentWidth);

  const safetyPt = mmToPt(8);
  const finalHeightPt = margins.top + contentHeight + margins.bottom + safetyPt;

  const doc = new PDFDocument({ autoFirstPage: false });
  doc.addPage({ size: [pageWidthPt, finalHeightPt], margins });

  const chunks = [];
  doc.on("data", (c) => chunks.push(c));

  renderReceipt(doc, companyInfo, sale, contentWidth);

  doc.end();

  return await new Promise((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
}

async function generateSaleReceiptPDF(companyInfo, sale) {
  const browserArgs =
    process.env.NODE_ENV.toLowerCase() === "production"
      ? ["--no-sandbox", "--disable-setuid-sandbox", "--no-zygote", "--single-process"]
      : ["--no-sandbox", "--disable-setuid-sandbox"];

  const browser = await puppeteer.launch({ headless: "new", args: browserArgs });
  const page = await browser.newPage();

  await page.setViewport({ width: 320, height: 800, deviceScaleFactor: 2 });

  const html = `
  <html>
  <head>
    <meta charset="utf-8" />
    <style>
      @page { margin: 0; }
      body {
        font-family: monospace;
        font-size: 12px;
        width: 80mm;
        margin: 0;
        padding: 8px;
        box-sizing: border-box;
      }
      .center { text-align: center; }
      .bold { font-weight: bold; }
      .big { font-size: 14px; }
      .line { border-top: 1px dashed #000; margin: 6px 0; }
      .item { margin-bottom: 6px; }
      .item-name { font-weight: bold; }
      .row { display: flex; justify-content: space-between; gap: 10px; }
      .row span:last-child { text-align: right; white-space: nowrap; }
      .footer { margin-top: 8px; font-size: 11px; }
    </style>
  </head>
  <body>

    <div class="center bold big">${escapeHtml(companyInfo.name || "-")}</div>

    <div class="center">
      ${escapeHtml(companyInfo.address || "")}<br/>
      Tel: ${escapeHtml(companyInfo.contact || "-")}<br/>
      NUIT: ${escapeHtml(companyInfo.nuit || "-")}
    </div>

    <div class="line"></div>

    <div>
      <div>Recibo Nº: ${escapeHtml(sale.receiptNumber || sale._id || "-")}</div>
      <div>Data: ${escapeHtml(formatedDate(sale.createdAt || new Date()))}</div>
      <div>Operador: ${escapeHtml(sale.operatorName || "Sistema")}</div>
    </div>

    <div class="line"></div>

    ${(sale.items || []).map(item => `
      <div class="item">
        <div class="item-name">${escapeHtml(item.name || item.description || "Produto")}</div>
        <div class="row">
          <span>${Number(item.quantity || 0)} x ${formatCurrency(item.price ?? item.unitPrice ?? 0)}</span>
          <span>${formatCurrency(Number(item.quantity || 0) * Number(item.price ?? item.unitPrice ?? 0))}</span>
        </div>
      </div>
    `).join("")}

    <div class="line"></div>

    <div>
      <div class="row bold big">
        <span>TOTAL</span>
        <span>${formatCurrency(sale.total)}</span>
      </div>
      <div class="row">
        <span>Pago</span>
        <span>${formatCurrency(sale.paidAmount ?? sale.total)}</span>
      </div>
      <div class="row">
        <span>Troco</span>
        <span>${formatCurrency((sale.paidAmount ?? sale.total) - sale.total)}</span>
      </div>
    </div>

    <div class="line"></div>

    <div class="center footer">
      Obrigado pela preferência!<br/>
      Volte sempre
    </div>

  </body>
  </html>
  `;

  await page.setContent(html, { waitUntil: "networkidle0" });

  const contentHeight = await page.evaluate(() => {
    const body = document.body;
    const html = document.documentElement;
    return Math.max(
      body.scrollHeight,
      body.offsetHeight,
      html.clientHeight,
      html.scrollHeight,
      html.offsetHeight
    );
  });

  const extra = 40;
  const heightPx = contentHeight + extra;

  const pdfBuffer = await page.pdf({
    width: "80mm",
    height: `${heightPx}px`,
    printBackground: true,
    margin: { top: "0mm", bottom: "0mm", left: "0mm", right: "0mm" },
    preferCSSPageSize: false
  });

  await browser.close();
  return pdfBuffer;
}

async function generateCreditNotePDF(companyInfo, note, relatedInvoiceNumber) {
  const html = buildA4DocumentHtml({
    companyInfo,
    title: "NOTA DE CRÉDITO",
    docNumberLabel: "Nota de Crédito Nº",
    docNumber: note.invoiceNumber,
    date: note.date,
    clientName: note.clientName,
    clientNUIT: note.clientNUIT,
    items: note.items || [],
    totals: {
      subTotal: note.subTotal,
      appliedTax: note.appliedTax,
      tax: note.tax,
      totalAmount: note.totalAmount,
    },
    bankBlock: "",
    footerNotes: [
      `Referente à Factura: ${relatedInvoiceNumber || "—"}`,
      `Motivo: ${note.reason || "—"}`,
      "Esta Nota de Crédito anula total ou parcialmente a factura acima referenciada.",
      `Emitido por: ${companyInfo.name || "-"} | Contacto: ${companyInfo.contact || "-"}`,
    ],
  });

  return await renderA4Pdf(html);
}

async function generateDebitNotePDF(companyInfo, note, relatedInvoiceNumber) {
  const html = buildA4DocumentHtml({
    companyInfo,
    title: "NOTA DE DÉBITO",
    docNumberLabel: "Nota de Débito Nº",
    docNumber: note.invoiceNumber,
    date: note.date,
    clientName: note.clientName,
    clientNUIT: note.clientNUIT,
    items: note.items || [],
    totals: {
      subTotal: note.subTotal,
      appliedTax: note.appliedTax,
      tax: note.tax,
      totalAmount: note.totalAmount,
    },
    bankBlock: renderBankDetailsBlock(companyInfo, "invoice"),
    footerNotes: [
      `Referente à Factura: ${relatedInvoiceNumber || "—"}`,
      `Motivo: ${note.reason || "—"}`,
      "Esta Nota de Débito acrescenta valores à factura acima referenciada.",
      `Em caso de dúvidas, contacte: ${companyInfo.email || "-"} | ${companyInfo.contact || "-"}`,
    ],
  });

  return await renderA4Pdf(html);
}

module.exports = {
  generateQuotationPDF,
  generateInvoicePDF,
  generateVDPDF,
  generateReciboPDF,
  generateCreditNotePDF,
  generateDebitNotePDF,
  generateSaleReceiptPDF,
  generateSaleReceiptPDFKit,
};