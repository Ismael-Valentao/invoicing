function normalizeInvoiceStatus(status) {
    if (status.trim() === "paid") {
        return "PAGO"
    }
    else if(status.trim() === "unpaid") {
        return "PENDENTE"
    }
    else if(status.trim() === "overdue") {
        return "VENCIDO"
    }
    return "INDEFINIDO"
}

module.exports = {normalizeInvoiceStatus}