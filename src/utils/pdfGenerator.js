const puppeteer = require("puppeteer");
const path = require("path");
const { formatedDate } = require("./dateFormatter");
require("dotenv").config();
const PDFDocument = require("pdfkit");

function mmToPt(mm) {
    return (mm * 72) / 25.4;
}

function formatCurrency(v) {
    return new Intl.NumberFormat("pt-MZ", {
        style: "currency",
        currency: "MZN",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(Number(v || 0)).replace("MTn", "MZN");
}

// mede exatamente o que vamos desenhar (mesmo fontSize, mesma largura, mesmas quebras)
function calcHeight(doc, blocks, contentWidth) {
    let h = 0;

    for (const b of blocks) {
        if (b.type === "gap") {
            // gap em linhas
            doc.font("Courier").fontSize(b.fontSize || 9);
            h += (b.lines || 0) * doc.currentLineHeight(true);
            continue;
        }

        if (b.type === "line") {
            doc.font("Courier").fontSize(b.fontSize || 9);
            const lineH = doc.heightOfString(b.text, { width: contentWidth, align: b.align || "left" });
            h += lineH;
            continue;
        }

        if (b.type === "text") {
            doc.font("Courier").fontSize(b.fontSize || 9);
            const textH = doc.heightOfString(b.text, { width: contentWidth, align: b.align || "left" });
            h += textH;
            continue;
        }

        if (b.type === "row") {
            // row é 1 linha (qty x price | total)
            doc.font("Courier").fontSize(b.fontSize || 9);
            h += doc.currentLineHeight(true);
            continue;
        }
    }

    return h;
}

function buildBlocks(companyInfo, sale) {
    const receiptNo = sale.receiptNumber || String(sale._id);
    const dateStr = new Date(sale.createdAt || Date.now()).toLocaleString("pt-MZ");
    const operator = sale.operatorName || "Sistema";
    const dash = "----------------------------------------";

    const blocks = [];

    // Header
    blocks.push({ type: "text", text: companyInfo.name || "-", fontSize: 12, align: "center" });
    blocks.push({ type: "text", text: companyInfo.address || "", fontSize: 9, align: "center" });
    blocks.push({ type: "text", text: `Tel: ${companyInfo.contact || "-"}`, fontSize: 9, align: "center" });
    blocks.push({ type: "text", text: `NUIT: ${companyInfo.nuit || "-"}`, fontSize: 9, align: "center" });

    blocks.push({ type: "gap", lines: 0.4, fontSize: 9 });
    blocks.push({ type: "line", text: dash, fontSize: 9, align: "center" });

    // Sale info
    blocks.push({ type: "text", text: `Recibo Nº: ${receiptNo}`, fontSize: 9 });
    blocks.push({ type: "text", text: `Data: ${dateStr}`, fontSize: 9 });
    blocks.push({ type: "text", text: `Operador: ${operator}`, fontSize: 9 });

    blocks.push({ type: "gap", lines: 0.4, fontSize: 9 });
    blocks.push({ type: "line", text: dash, fontSize: 9, align: "center" });

    // Items
    for (const item of sale.items || []) {
        blocks.push({ type: "text", text: item.description || "Produto", fontSize: 9 });
        blocks.push({ type: "row", fontSize: 9 }); // 1 linha com valores
        blocks.push({ type: "gap", lines: 0.2, fontSize: 9 });
    }

    blocks.push({ type: "line", text: dash, fontSize: 9, align: "center" });

    // Totals (3 linhas)
    blocks.push({ type: "row", fontSize: 11 }); // TOTAL
    blocks.push({ type: "row", fontSize: 9 });  // Pago
    blocks.push({ type: "row", fontSize: 9 });  // Troco

    blocks.push({ type: "gap", lines: 0.4, fontSize: 9 });
    blocks.push({ type: "line", text: dash, fontSize: 9, align: "center" });

    // Footer
    blocks.push({ type: "text", text: "Obrigado pela preferência!", fontSize: 9, align: "center" });
    blocks.push({ type: "text", text: "Volte sempre", fontSize: 9, align: "center" });

    return blocks;
}

function render(doc, companyInfo, sale, contentWidth) {
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
        const name = item.name || "Produto";
        const qty = Number(item.quantity || 0);
        const price = Number(item.price || 0);

        doc.fontSize(9).text(name, { width: contentWidth });

        // linha: esquerda + direita
        doc.text(`${qty} x ${formatCurrency(price)}`, { continued: true, width: contentWidth });
        doc.text(`${formatCurrency(qty * price)}`, { align: "right" });

        doc.moveDown(0.2);
    }

    doc.text(dash, { align: "center", width: contentWidth });

    // TOTAL
    doc.fontSize(11).text("TOTAL", { continued: true, width: contentWidth });
    doc.text(formatCurrency(sale.total), { align: "right" });

    // Pago
    doc.fontSize(9).text("Pago", { continued: true, width: contentWidth });
    doc.text(formatCurrency(sale.paidAmount ?? sale.total), { align: "right" });

    // Troco
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

    // ✅ doc “fantasma” só pra medir (não gera buffer final)
    const measureDoc = new PDFDocument({ autoFirstPage: false });
    measureDoc.addPage({ size: [pageWidthPt, mmToPt(200)], margins }); // tamanho qualquer (só pro font engine)

    const blocks = buildBlocks(companyInfo, sale);

    const contentHeight = calcHeight(measureDoc, blocks, contentWidth);

    // ✅ altura FINAL = margens + conteúdo (sem “teto” gigante)
    const safetyPt = mmToPt(8); // 8mm de folga (ajusta 5–10mm)
    const finalHeightPt = margins.top + contentHeight + margins.bottom + safetyPt;

    // ✅ Agora cria o PDF de verdade com a altura exata
    const doc = new PDFDocument({ autoFirstPage: false });
    doc.addPage({ size: [pageWidthPt, finalHeightPt], margins });

    const chunks = [];
    doc.on("data", (c) => chunks.push(c));

    render(doc, companyInfo, sale, contentWidth);

    doc.end();

    return await new Promise((resolve, reject) => {
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);
    });
}



const logoPath = process.env.LOGO_PATH || "https://bitiray.com/public/invoicing-logos/";

function formatCurrency(value, currencyNameOption = false) {
    const formatedValue = new Intl.NumberFormat("pt-MZ", {
        style: "currency",
        currency: "MZN",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value);

    if (currencyNameOption) {
        return formatedValue.replace("MTn", "MZN");
    }
    return formatedValue.replace("MTn", "");
}

async function generateInvoicePDF(companyInfo, invoice) {
    const browserArgs =
        process.env.NODE_ENV.toLowerCase() === "production"
            ? [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--no-zygote",
                "--single-process",
            ]
            : ["--no-sandbox", "--disable-setuid-sandbox"];

    const browser = await puppeteer.launch({
        headless: "new",
        args: browserArgs,
    });

    const page = await browser.newPage();

    const html = `
<html lang="en">
<head>
    <style>
        body {
            font-family: Helvetica, Arial, sans-serif;
            margin:0;
            padding:0;
        }

        .page {
            position: relative;
            width: 794px;
            height: 1123px;
            margin: 0;
            padding: 40px;
            padding-top:20px;
            box-sizing: border-box;
            background: white;
        }

        .company-info {
            font-size: 0.8rem;
        }

        .company-info p {
            margin: 0;
            margin-bottom: 5px;
        }

        .invoice {
            font-size: 1.2rem;
            font-weight: bold;
            margin: 30px auto;
            text-align: center;
        }

        .invoice-header,
        .invoice-client-info {
            display: flex;
            justify-content: space-between;
        }

        .invoice-client-info{
            margin-bottom: 30px;
        }

        .invoice-client-info p {
            font-size: 0.8rem;
        }

        .invoice-footer {
            position: absolute;
            left: 0;
            right: 0;
            bottom: 30px;
            justify-content: center;
        }

        .invoice-footer div.first{
            margin-bottom: 20px;
        }

        .invoice-footer p {
            font-size: 0.7rem;
            text-align: center;
        }

        h1 {
            text-align: center;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }

        th,
        td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
            font-size:0.8rem;
        }

        .text-center{
        text-align:center !important;
        }

        .text-right{
        text-align:right !important;
        }
        th {
            background-color: #f2f2f2;
        }
    </style>
</head>

<body>
    <div class="page">
        <div class="invoice-header">
            <div><img src="${companyInfo.logoUrl
            ? logoPath + companyInfo.logoUrl
            : logoPath + "logo-default.png"
        }" width="190" alt="logo"></div>
            <div class="company-info">
                <p><strong>${companyInfo.name}</strong></p>
                <p>${companyInfo.address}</p>
                <p><strong>Cell:</strong> ${companyInfo.contact}</p>
                <p><strong>Email:</strong> ${companyInfo.email} </p>
                <p><strong>NUIT:</strong> ${companyInfo.nuit}</p>
            </div>
        </div>
        <p class="invoice">FACTURA</p>
        <div class="invoice-client-info">
            <div>
                <p><strong>Cliente:</strong> ${invoice.clientName}</p>
                <p><strong>NUIT: </strong>${invoice.clientNUIT}</p>
            </div>
            <div>
                <div>
                    <div>
                        <p><strong>Factura Nº:</strong> ${invoice.invoiceNumber
        }</p>
                    </div>
                    <div>
                        <p><strong>Data:</strong> ${formatedDate(
            invoice.date
        )}</p>
                    </div>
                </div>
            </div>
        </div>
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
                ${invoice.items
            .map(
                (item) => `
                <tr>
                    <td>${item.description}</td>
                    <td class="text-center">${item.quantity}</td>
                    <td class="text-center">${formatCurrency(item.unitPrice)}</td>
                    <td class="text-right">${formatCurrency(item.quantity * item.unitPrice)}</td>
                </tr>
                `
            )
            .join("")}
            </tbody>
            <tfoot>
                <tr>
                    <td colspan="3">Sub-Total:</td>
                    <td class="text-right">${formatCurrency(invoice.subTotal)}</td>
                </tr>
                <tr>
                    <td colspan="3">IVA (${invoice.appliedTax * 100}%):</td>
                    <td class="text-right">${formatCurrency(invoice.tax)}</td>
                </tr>
                <tr>
                    <td colspan="3">Total:</td>
                    <td class="text-right">${formatCurrency(invoice.totalAmount, true)}</td>
                </tr>
            </tfoot>
        </table>
        
        <div class="invoice-footer">
            <div class="first">
                <p>Atenção: Esta factura serve como documento comprovativo de prestação de serviços e/ou fornecimento de
                    materiais.</p>
                <p>Prazo de pagamento: até 15 dias após a emissão da presente factura.</p>
                <p>Em caso de dúvidas, contactar o departamento financeiro: ${companyInfo.email
        } | ${companyInfo.contact}</p>
         ${companyInfo.showBankDetails.invoices && companyInfo.bankDetails && companyInfo.bankDetails.bank ? `<div>
            <p><strong>Banco:</strong> ${companyInfo.bankDetails.bank} | <strong>Nome da Conta:</strong> ${companyInfo.bankDetails.account_name}</p>
            <p><strong>Nº da Conta:</strong> ${companyInfo.bankDetails.account_number} | <strong>NIB:</strong> ${companyInfo.bankDetails.nib || '-'}</p>
        </div>` : ``}
            </div>
        </div>
    </div>
</body>
</html>
  `;

    await page.setContent(html, { waitUntil: "networkidle0", timeout: 0 });

    const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: {
            top: "20mm",
            right: "15mm",
            bottom: "20mm",
            left: "15mm",
        },
    });

    await browser.close();

    return pdfBuffer;
}

async function generateQuotationPDF(companyInfo, quotation) {
    const browserArgs =
        process.env.NODE_ENV.toLowerCase() === "production"
            ? [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--no-zygote",
                "--single-process",
            ]
            : ["--no-sandbox", "--disable-setuid-sandbox"];

    const browser = await puppeteer.launch({
        headless: "new",
        args: browserArgs,
    });

    const page = await browser.newPage();

    // HTML básico da fatura — você pode estilizar mais depois
    const html = `
<html lang="en">

<head>
    <style>
        body {
            font-family: Helvetica, Arial, sans-serif;
            margin:0;
            padding:0;
        }

        .page {
            position: relative;
            width: 794px;
            height: 1123px;
            margin: 0;
            padding: 40px;
            padding-top:30px;
            box-sizing: border-box;
            background: white;
        }

        .company-info {
            font-size: 0.8rem;
        }

        .company-info p {
            margin: 0;
            margin-bottom: 5px;
        }

        .invoice {
            font-size: 1.2rem;
            font-weight: bold;
            margin: 30px auto;
            text-align: center;
        }

        .invoice-header,
        .invoice-client-info {
            display: flex;
            justify-content: space-between;
        }

        .invoice-client-info{
            margin-bottom: 30px;
        }

        .invoice-client-info p {
            font-size: 0.8rem;
        }

        .invoice-footer {
            position: absolute;
            left: 0;
            right: 0;
            bottom: 30px;
            justify-content: center;
        }

        .invoice-footer div.first{
            margin-bottom: 20px;
        }

        .invoice-footer p {
            font-size: 0.7rem;
            text-align: center;
        }

        h1 {
            text-align: center;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }

        th,
        td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
            font-size:0.8rem;
        }

        .text-center{
        text-align:center !important;
        }

        .text-right{
        text-align:right !important;
        }
        th {
            background-color: #f2f2f2;
        }
    </style>
</head>

<body>
    <div class="page">
        <div class="invoice-header">
            <div><img src="${companyInfo.logoUrl
            ? logoPath + companyInfo.logoUrl
            : logoPath + "logo-default.png"
        }" width="190" alt="logo"></div>
            <div class="company-info">
                <p><strong>${companyInfo.name}</strong></p>
                <p>${companyInfo.address}</p>
                <p><strong>Cell:</strong> ${companyInfo.contact}</p>
                <p><strong>Email:</strong> ${companyInfo.email} </p>
                <p><strong>NUIT:</strong> ${companyInfo.nuit}</p>
            </div>
        </div>
        <p class="invoice">COTAÇÃO</p>
        <div class="invoice-client-info">
            <div>
                <p><strong>Cliente:</strong> ${quotation.clientName}</p>
                <p><strong>NUIT: </strong>${quotation.clientNUIT}</p>
            </div>
            <div>
                <div>
                    <div>
                        <p><strong>COTAÇÂO Nº:</strong> ${quotation.quotationNumber
        }</p>
                    </div>
                    <div>
                        <p><strong>Data:</strong> ${formatedDate(
            quotation.date
        )}</p>
                    </div>
                </div>
            </div>
        </div>
        <table>
            <thead>
                <tr>
                    <th>Descrição</th>
                    <th class="text-center">Quantidade</th>
                    <th class='text-center'>Preço Unitário</th>
                    <th class="text-right">Total</th>
                </tr>
            </thead>
            <tbody>
                ${quotation.items
            .map(
                (item) => `
                <tr>
                    <td>${item.description}</td>
                    <td class="text-center">${item.quantity}</td>
                    <td class="text-center">${formatCurrency(item.unitPrice)}</td>
                    <td class="text-right">${formatCurrency(item.quantity * item.unitPrice)}</td>
                </tr>
                `
            )
            .join("")}
            </tbody>
            <tfoot>
                <tr>
                    <td colspan="3">Sub-Total:</td>
                    <td class="text-right">${formatCurrency(quotation.subTotal)}</td>
                </tr>
                <tr>
                    <td colspan="3">IVA (${quotation.appliedTax * 100}%):</td>
                    <td class="text-right">${formatCurrency(quotation.tax)}</td>
                </tr>
                <tr>
                    <td colspan="3">Total:</td>
                    <td class="text-right">${formatCurrency(quotation.totalAmount, true)}</td>
                </tr>
            </tfoot>

        </table>
        
        <div class="invoice-footer">
            <div class="first">
                <p>Atenção: Esta cotação serve como documento comprovativo da proposta de prestação de serviços e/ou fornecimento de materiais.</p>
                <p>Em caso de dúvidas, contactar o departamento financeiro: ${companyInfo.email
        } | ${companyInfo.contact}</p>

         ${companyInfo.showBankDetails.quotations && companyInfo.bankDetails && companyInfo.bankDetails.bank ? `<div>
            <p><strong>Banco:</strong> ${companyInfo.bankDetails.bank} | <strong>Nome da Conta:</strong> ${companyInfo.bankDetails.account_name}</p>
            <p><strong>Nº da Conta:</strong> ${companyInfo.bankDetails.account_number} | <strong>NIB:</strong> ${companyInfo.bankDetails.nib || '-'}</p>
        </div>` : ``}
            </div>
        </div>
    </div>
</body>

</html>
  `;

    await page.setContent(html, { waitUntil: "networkidle0", timeout: 0 });

    const pdfBuffer = await page.pdf({ format: "A4" });

    await browser.close();

    return pdfBuffer;
}

async function generateVDPDF(companyInfo, vd) {
    const browserArgs =
        process.env.NODE_ENV.toLowerCase() === "production"
            ? [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--no-zygote",
                "--single-process",
            ]
            : ["--no-sandbox", "--disable-setuid-sandbox"];

    const browser = await puppeteer.launch({
        headless: "new",
        args: browserArgs,
    });

    const page = await browser.newPage();

    const html = `
<html lang="en">

<head>
    <style>
        body {
            font-family: Helvetica, Arial, sans-serif;
            margin:0;
            padding:0;
        }

        .page {
            position: relative;
            width: 794px;
            height: 1123px;
            margin: 0;
            padding: 40px;
            padding-top:30px;
            box-sizing: border-box;
            background: white;
        }

        .company-info {
            font-size: 0.8rem;
        }

        .company-info p {
            margin: 0;
            margin-bottom: 5px;
        }

        .invoice {
            font-size: 1.2rem;
            font-weight: bold;
            margin: 30px auto;
            text-align: center;
        }

        .invoice-header,
        .invoice-client-info {
            display: flex;
            justify-content: space-between;
        }

        .invoice-client-info{
            margin-bottom: 30px;
        }

        .invoice-client-info p {
            font-size: 0.8rem;
        }

        .invoice-footer {
            position: absolute;
            left: 0;
            right: 0;
            bottom: 30px;
            justify-content: center;
        }

        .invoice-footer div.first{
            margin-bottom: 20px;
        }

        .invoice-footer p {
            font-size: 0.7rem;
            text-align: center;
        }

        h1 {
            text-align: center;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }

        th,
        td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
            font-size:0.8rem;
        }

        .text-center{
        text-align:center !important;
        }

        .text-right{
        text-align:right !important;
        }

        th {
            background-color: #f2f2f2;
        }
    </style>
</head>

<body>
    <div class="page">
        <div class="invoice-header">
            <div><img src="${companyInfo.logoUrl
            ? logoPath + companyInfo.logoUrl
            : logoPath + "logo-default.png"
        }" width="190" alt="logo"></div>
            <div class="company-info">
                <p><strong>${companyInfo.name}</strong></p>
                <p>${companyInfo.address}</p>
                <p><strong>Cell:</strong> ${companyInfo.contact}</p>
                <p><strong>Email:</strong> ${companyInfo.email} </p>
                <p><strong>NUIT:</strong> ${companyInfo.nuit}</p>
            </div>
        </div>
        <p class="invoice">VENDA A DINHEIRO</p>
        <div class="invoice-client-info">
            <div>
                <p><strong>Cliente:</strong> ${vd.clientName}</p>
                <p><strong>NUIT: </strong>${vd.clientNUIT}</p>
            </div>
            <div>
                <div>
                    <div>
                        <p><strong>VD Nº:</strong> ${vd.invoiceNumber}</p>
                    </div>
                    <div>
                        <p><strong>Data:</strong> ${formatedDate(vd.date)}</p>
                    </div>
                </div>
            </div>
        </div>
        <table>
            <thead>
                <tr>
                    <th>Descrição</th>
                    <th class="text-center">Quantidade</th>
                    <th class='text-center'>Preço Unitário</th>
                    <th class="text-right">Total</th>
                </tr>
            </thead>
            <tbody>
                ${vd.items
            .map(
                (item) => `
                <tr>
                    <td>${item.description}</td>
                    <td class="text-center">${item.quantity}</td>
                    <td class="text-center">${formatCurrency(item.unitPrice)}</td>
                    <td class="text-right">${formatCurrency(item.quantity * item.unitPrice)}</td>
                </tr>
                `
            )
            .join("")}
            </tbody>
            <tfoot>
                <tr>
                    <td colspan="3">Sub-Total:</td>
                    <td>${formatCurrency(vd.subTotal)}</td>
                </tr>
                <tr>
                    <td colspan="3">IVA (${vd.appliedTax * 100}%):</td>
                    <td>${formatCurrency(vd.tax)}</td>
                </tr>
                <tr>
                    <td colspan="3">Total:</td>
                    <td>${formatCurrency(vd.totalAmount, true)}</td>
                </tr>
            </tfoot>
        </table>
        
        <div class="invoice-footer">
            <div class="first">
                <p>Este documento comprova o pagamento imediato dos produtos/serviços prestados.</p>
                <p>Não necessita de factura adicional. Guardar este documento como comprovativo legal.</p>
                <p>Emitido por: ${companyInfo.name} | Contacto: ${companyInfo.contact
        }</p>
            </div>
        </div>
    </div>
</body>

</html>
  `;

    await page.setContent(html, { waitUntil: "networkidle0", timeout: 0 });

    const pdfBuffer = await page.pdf({ format: "A4" });

    await browser.close();

    return pdfBuffer;
}

async function generateReciboPDF(companyInfo, invoice) {
    const browserArgs =
        process.env.NODE_ENV.toLowerCase() === "production"
            ? [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--no-zygote",
                "--single-process",
            ]
            : ["--no-sandbox", "--disable-setuid-sandbox"];

    const browser = await puppeteer.launch({
        headless: "new",
        args: browserArgs,
    });

    const page = await browser.newPage();

    const html = `
<html lang="en">

<head>
    <style>
        body {
            font-family: Helvetica, Arial, sans-serif;
            margin:0;
            padding:0;
        }

        .page {
            position: relative;
            width: 794px;
            height: 1123px;
            margin: 0;
            padding: 40px;
            padding-top:30px;
            box-sizing: border-box;
            background: white;
        }

        .company-info {
            font-size: 0.8rem;
        }

        .company-info p {
            margin: 0;
            margin-bottom: 5px;
        }

        .invoice {
            font-size: 1.2rem;
            font-weight: bold;
            margin: 30px auto;
            text-align: center;
        }

        .invoice-header,
        .invoice-client-info {
            display: flex;
            justify-content: space-between;
        }

        .invoice-client-info{
            margin-bottom: 30px;
        }

        .invoice-client-info p {
            font-size: 0.8rem;
        }

        .invoice-footer {
            position: absolute;
            left: 0;
            right: 0;
            bottom: 30px;
            justify-content: center;
        }

        .invoice-footer div.first{
            margin-bottom: 20px;
        }

        .invoice-footer p {
            font-size: 0.7rem;
            text-align: center;
        }

        h1 {
            text-align: center;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }

        th,
        td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
            font-size:0.8rem;
        }

        .text-center{
        text-align:center !important;
        }

        .text-right{
        text-align:right !important;
        }
        th {
            background-color: #f2f2f2;
        }
    </style>
</head>

<body>
     <div class="page">
        <div class="invoice-header">
            <div><img src="${companyInfo.logoUrl
            ? logoPath + companyInfo.logoUrl
            : logoPath + "logo-default.png"
        }" width="190" alt="logo"></div>
            <div class="company-info">
                <p><strong>${companyInfo.name}</strong></p>
                <p>${companyInfo.address}</p>
                <p><strong>Cell:</strong> ${companyInfo.contact}</p>
                <p><strong>Email:</strong> ${companyInfo.email} </p>
                <p><strong>NUIT:</strong> ${companyInfo.nuit}</p>
            </div>
        </div>
        <p class="invoice">RECIBO</p>
        <div class="invoice-client-info">
            <div>
                <p><strong>Cliente:</strong> ${invoice.clientName}</p>
                <p><strong>NUIT: </strong>${invoice.clientNUIT}</p>
            </div>
            <div>
                <p><strong>Recibo Nº:</strong> ${invoice.reciboNumber}</p>
                <p><strong>Data:</strong> ${formatedDate(invoice.date)}</p>
            </div>
        </div>
        <table>
            <thead>
                <tr>
                    <th>Descrição</th>
                    <th class="text-center">Quantidade</th>
                    <th class='text-center'>Preço Unitário</th>
                    <th class="text-right">Total</th>
                </tr>
            </thead>
            <tbody>
                ${invoice.items
            .map(
                (item) => `
                <tr>
                    <td>${item.description}</td>
                    <td class="text-center">${item.quantity}</td>
                    <td class="text-center">${formatCurrency(item.unitPrice)}</td>
                    <td class="text-right">${formatCurrency(item.quantity * item.unitPrice)}</td>
                </tr>`
            )
            .join("")}
            </tbody>
            <tfoot>
               <tr>
                    <td colspan="3">Sub-Total:</td>
                    <td class="text-right">${formatCurrency(invoice.subTotal)}</td>
                </tr>
                <tr>
                    <td colspan="3">IVA (${invoice.appliedTax * 100}%):</td>
                    <td class="text-right">${formatCurrency(invoice.tax)}</td>
                </tr>
                <tr>
                    <td colspan="3">Total:</td>
                    <td class="text-right">${formatCurrency(invoice.totalAmount, true)}</td>
                </tr>
            </tfoot>
        </table>
        <div class="invoice-footer">
            <div class="first">
                <p>Este recibo confirma o pagamento referente aos serviços ou produtos descritos acima.</p>
                <p>Data do pagamento: ${formatedDate(
                new Date().toISOString()
            )}</p>
                <p>Emitido por: ${companyInfo.name} | Contacto: ${companyInfo.contact
        }</p>
            </div>
        </div>
    </div>
</body>

</html>
  `;

    await page.setContent(html, { waitUntil: "networkidle0", timeout: 0 });

    const pdfBuffer = await page.pdf({ format: "A4" });

    await browser.close();

    return pdfBuffer;
}

async function generateSaleReceiptPDF(companyInfo, sale) {
    const browserArgs =
        process.env.NODE_ENV.toLowerCase() === "production"
            ? ["--no-sandbox", "--disable-setuid-sandbox", "--no-zygote", "--single-process"]
            : ["--no-sandbox", "--disable-setuid-sandbox"];

    const browser = await puppeteer.launch({ headless: "new", args: browserArgs });
    const page = await browser.newPage();

    // (Opcional) deixa o viewport consistente
    await page.setViewport({ width: 320, height: 800, deviceScaleFactor: 2 }); // ~80mm em px (aprox)

    const html = `
  <html>
  <head>
    <meta charset="utf-8" />
    <style>
      @page { margin: 0; } /* importante */
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

    <div class="center bold big">${companyInfo.name}</div>

    <div class="center">
      ${companyInfo.address}<br/>
      Tel: ${companyInfo.contact}<br/>
      NUIT: ${companyInfo.nuit}
    </div>

    <div class="line"></div>

    <div>
      <div>Recibo Nº: ${sale.receiptNumber || sale._id}</div>
      <div>Data: ${formatedDate(sale.createdAt || new Date())}</div>
      <div>Operador: ${sale.operatorName || "Sistema"}</div>
    </div>

    <div class="line"></div>

    ${sale.items.map(item => `
      <div class="item">
        <div class="item-name">${item.name || "Produto"}</div>
        <div class="row">
          <span>${item.quantity} x ${formatCurrency(item.price)}</span>
          <span>${formatCurrency(item.quantity * item.price)}</span>
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

    // ✅ mede a altura real do conteúdo (inclui padding)
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

    // ✅ adiciona folga extra para evitar corte no fim (impressoras variam)
    const extra = 40; // px
    const heightPx = contentHeight + extra;

    const pdfBuffer = await page.pdf({
        width: "80mm",
        height: `${heightPx}px`, // 🔥 altura dinâmica
        printBackground: true,
        margin: { top: "0mm", bottom: "0mm", left: "0mm", right: "0mm" },
        preferCSSPageSize: false
    });

    await browser.close();
    return pdfBuffer;
}

module.exports = {
    generateQuotationPDF,
    generateInvoicePDF,
    generateVDPDF,
    generateReciboPDF,
    generateSaleReceiptPDF,
    generateSaleReceiptPDFKit
};
