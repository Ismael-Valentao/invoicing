/**
 * Gera nome de arquivo automático para extrato de facturas
 * @param {string|null} clientName - Nome do cliente selecionado, ou null/empty se todos
 * @param {string|null} startDate - Data de início no formato YYYY-MM-DD
 * @param {string|null} endDate - Data de fim no formato YYYY-MM-DD
 * @returns {string} Nome do arquivo
 */
function generateStatementFileName(clientName, startDate, endDate) {
    let nameParts = ["extrato_facturas"];

    // Cliente
    if (clientName && clientName.trim() !== "") {
        // Substitui espaços por underline e remove caracteres estranhos
        const safeClient = clientName.trim().replace(/\s+/g, "_").replace(/[^\w_-]/g, "");
        nameParts.push(safeClient);
    } else {
        nameParts.push("todos_clientes");
    }

    // Intervalo de datas
    if (startDate) {
        nameParts.push(`from_${startDate}`);
    }
    if (endDate) {
        nameParts.push(`to_${endDate}`);
    }

    return nameParts.join("_") + ".xlsx"; // extensão .xlsx
}

module.exports = { generateStatementFileName }