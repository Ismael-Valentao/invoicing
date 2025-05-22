
let pieData = [];
let totalInvoices = null;
let paidInvoices = null;
const getTotalAmount = async () => {
    const response = await fetch('/api/invoices/total-amount');
    const data = await response.json();
    document.getElementById('total-amount').innerText = formatarTotalFacturado(data.totalAmount)
}

const getTotalInvoices = async () => {
    const response = await fetch('/api/invoices/total-invoices');
    const data = await response.json();
    document.getElementById('total-invoices').innerText = data.totalInvoices;
    totalInvoices = data.totalInvoices;
    fillPieData(data.paidInvoices);
}

const getLastInvoice = async () => {
    const response = await fetch('/api/invoices/last-invoice');
    const data = await response.json();
    document.getElementById('last-invoice').innerText = data.lastInvoice;
}

const getPaidInvoices = async () => {
    const response = await fetch('/api/invoices/paid-invoices');
    const data = await response.json();
    document.getElementById('paid-invoices').innerText = data.paidInvoices;
    paidInvoices = data.paidInvoices;
    fillPieData(data.paidInvoices);
    createPieChart(pieData);
}

const getTotalClients = async () => {
    const response = await fetch('/api/clients/total-clients');
    const data = await response.json();
    document.getElementById('total-clients').innerText = data.totalClients;
}

const getTotalAmountByMonth = async () => {
    const response = await fetch('/api/invoices/total/months');
    const data = await response.json();
    let arrayMonths = new Array(12).fill(0);
    const dataArray = data.totalByMonth;

    dataArray.forEach((item) => {
        arrayMonths[item.month * 1 - 1] = item.total;
    });
    createAreaChart(arrayMonths);

}

function formatarTotalFacturado(valor) {
    if (isNaN(valor)) {
      return "Valor inválido";
    }
  
    return new Intl.NumberFormat('pt-MZ', {
      style: 'currency',
      currency: 'MZN' // Metical moçambicano
    }).format(valor).replace('MTn', 'MZN');
  }
  
document.addEventListener('DOMContentLoaded', async () => {
    getTotalAmount();
    getLastInvoice();
    getTotalAmountByMonth();
    await getTotalInvoices();
    getPaidInvoices();
    //await getTotalPaidInvoices();
    //await getTotalClients();
});

function fillPieData(paidInvoices) {
    if (totalInvoices === null) return;
    pieData[0] = paidInvoices;
    pieData[1] = totalInvoices - paidInvoices;
}
