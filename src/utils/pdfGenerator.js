const puppeteer = require("puppeteer");
const path = require("path");
const { formatedDate } = require("./dateFormatter");
require("dotenv").config();

const logoPath =
  process.env.NODE_ENV.toLowerCase() === "production"
    ? "https://bitiray.com/public/invoicing-logos/"
    : "http://localhost:3000/images/logos/";

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
            box-sizing: border-box;
            background: white;
            box-shadow: 0 10px 10px rgba(0, 0, 0, 0.3);
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

        th {
            background-color: #f2f2f2;
        }
    </style>
</head>

<body>
    <div class="page">
        <div class="invoice-header">
            <div><img src="${
              companyInfo.logoUrl
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
                        <p><strong>Factura Nº:</strong> ${
                          invoice.invoiceNumber
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
                    <th>Quantidade</th>
                    <th>Preço Unitário</th>
                    <th>Total</th>
                </tr>
            </thead>
            <tbody>
                ${invoice.items
                  .map(
                    (item) => `
                <tr>
                    <td>${item.description}</td>
                    <td>${item.quantity}</td>
                    <td>${formatCurrency(item.unitPrice)}</td>
                    <td>${formatCurrency(item.quantity * item.unitPrice)}</td>
                </tr>
                `
                  )
                  .join("")}
            </tbody>
            <tfoot>
                <tr>
                    <td colspan="3">Sub-Total:</td>
                    <td>${formatCurrency(invoice.subTotal)}</td>
                </tr>
                <tr>
                    <td colspan="3">IVA (${invoice.appliedTax * 100}%):</td>
                    <td>${formatCurrency(invoice.tax)}</td>
                </tr>
                <tr>
                    <td colspan="3">Total:</td>
                    <td>${formatCurrency(invoice.totalAmount, true)}</td>
                </tr>
            </tfoot>
        </table>
        
        <div class="invoice-footer">
            <div class="first">
                <p>Atenção: Esta factura serve como documento comprovativo de prestação de serviços e/ou fornecimento de
                    materiais.</p>
                <p>Prazo de pagamento: até 15 dias após a emissão da presente factura.</p>
                <p>Em caso de dúvidas, contactar o departamento financeiro: ${
                  companyInfo.email
                } | ${companyInfo.contact}</p>
            </div>
            <div>
                <p>Maputo - Moçambique</p>
            </div>
        </div>
    </div>
</body>
</html>
  `;

  await page.setContent(html, { waitUntil: "networkidle0" });

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
            box-sizing: border-box;
            background: white;
            box-shadow: 0 10px 10px rgba(0, 0, 0, 0.3);
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

        th {
            background-color: #f2f2f2;
        }
    </style>
</head>

<body>
    <div class="page">
        <div class="invoice-header">
            <div><img src="${
              companyInfo.logoUrl
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
                        <p><strong>COTAÇÂO Nº:</strong> ${
                          quotation.quotationNumber
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
                    <th>Quantidade</th>
                    <th>Preço Unitário</th>
                    <th>Total</th>
                </tr>
            </thead>
            <tbody>
                ${quotation.items
                  .map(
                    (item) => `
                <tr>
                    <td>${item.description}</td>
                    <td>${item.quantity}</td>
                    <td>${formatCurrency(item.unitPrice)}</td>
                    <td>${formatCurrency(item.quantity * item.unitPrice)}</td>
                </tr>
                `
                  )
                  .join("")}
            </tbody>
            <tfoot>
                <tr>
                    <td colspan="3">Sub-Total:</td>
                    <td>${formatCurrency(quotation.subTotal)}</td>
                </tr>
                <tr>
                    <td colspan="3">IVA (${quotation.appliedTax * 100}%):</td>
                    <td>${formatCurrency(quotation.tax)}</td>
                </tr>
                <tr>
                    <td colspan="3">Total:</td>
                    <td>${formatCurrency(quotation.totalAmount, true)}</td>
                </tr>
            </tfoot>
        </table>
        
        <div class="invoice-footer">
            <div class="first">
                <p>Atenção: Esta cotação serve como documento comprovativo da proposta de prestação de serviços e/ou fornecimento de materiais.</p>
                <p>Em caso de dúvidas, contactar o departamento financeiro: ${
                  companyInfo.email
                } | ${companyInfo.contact}</p>
            </div>
            <div>
                <p>Maputo - Moçambique</p>
            </div>
        </div>
    </div>
</body>

</html>
  `;

  await page.setContent(html, { waitUntil: "networkidle0" });

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
            box-sizing: border-box;
            background: white;
            box-shadow: 0 10px 10px rgba(0, 0, 0, 0.3);
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

        th {
            background-color: #f2f2f2;
        }
    </style>
</head>

<body>
    <div class="page">
        <div class="invoice-header">
            <div><img src="${
              companyInfo.logoUrl
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
                    <th>Quantidade</th>
                    <th>Preço Unitário</th>
                    <th>Total</th>
                </tr>
            </thead>
            <tbody>
                ${vd.items
                  .map(
                    (item) => `
                <tr>
                    <td>${item.description}</td>
                    <td>${item.quantity}</td>
                    <td>${formatCurrency(item.unitPrice)}</td>
                    <td>${formatCurrency(item.quantity * item.unitPrice)}</td>
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
                <p>Emitido por: ${companyInfo.name} | Contacto: ${
    companyInfo.contact
  }</p>
            </div>
        </div>
    </div>
</body>

</html>
  `;

  await page.setContent(html, { waitUntil: "networkidle0" });

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
            box-sizing: border-box;
            background: white;
            box-shadow: 0 10px 10px rgba(0, 0, 0, 0.3);
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

        th {
            background-color: #f2f2f2;
        }
    </style>
</head>

<body>
     <div class="page">
        <div class="invoice-header">
            <div><img src="${
              companyInfo.logoUrl
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
                    <th>Quantidade</th>
                    <th>Preço Unitário</th>
                    <th>Total</th>
                </tr>
            </thead>
            <tbody>
                ${invoice.items
                  .map(
                    (item) => `
                <tr>
                    <td>${item.description}</td>
                    <td>${item.quantity}</td>
                    <td>${formatCurrency(item.unitPrice)}</td>
                    <td>${formatCurrency(item.quantity * item.unitPrice)}</td>
                </tr>`
                  )
                  .join("")}
            </tbody>
            <tfoot>
               <tr>
                    <td colspan="3">Sub-Total:</td>
                    <td>${formatCurrency(invoice.subTotal)}</td>
                </tr>
                <tr>
                    <td colspan="3">IVA (${invoice.appliedTax * 100}%):</td>
                    <td>${formatCurrency(invoice.tax)}</td>
                </tr>
                <tr>
                    <td colspan="3">Total:</td>
                    <td>${formatCurrency(invoice.totalAmount, true)}</td>
                </tr>
            </tfoot>
        </table>
        <div class="invoice-footer">
            <div class="first">
                <p>Este recibo confirma o pagamento referente aos serviços ou produtos descritos acima.</p>
                <p>Data do pagamento: ${formatedDate(
                  new Date().toISOString()
                )}</p>
                <p>Emitido por: ${companyInfo.name} | Contacto: ${
    companyInfo.contact
  }</p>
            </div>
        </div>
    </div>
</body>

</html>
  `;

  await page.setContent(html, { waitUntil: "networkidle0" });

  const pdfBuffer = await page.pdf({ format: "A4" });

  await browser.close();

  return pdfBuffer;
}

module.exports = {
  generateQuotationPDF,
  generateInvoicePDF,
  generateVDPDF,
  generateReciboPDF,
};
