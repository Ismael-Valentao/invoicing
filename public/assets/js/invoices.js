const table = $('#dataTable').DataTable();
let selectedRow = null;

function statusBadge(status) {
    switch (status) {
        case 'paid':
            return '<span class="badge badge-success p-1 w-100">Pago</span>';
        case 'unpaid':
            return '<span class="badge badge-warning p-1 w-100">Pendente</span>';
        case 'overdue':
            return '<span class="badge badge-danger p-1 w-100">Vencido</span>';
        case 'partial':
            return '<span class="badge badge-info p-1 w-100">Parcial</span>';
        case 'cancelled':
            return '<span class="badge badge-dark p-1 w-100">Anulada</span>';
        default:
            return '<span class="badge badge-secondary p-1 w-100">Desconhecido</span>';
    }
}

function formatAmount(value) {
    const amount = Number(value || 0);
    return amount.toLocaleString('pt-PT', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function actionButtons(invoice) {
    const downloadBtn = `
        <a href="/api/invoices/${invoice._id}/pdf" class="btn btn-primary btn-sm text-center btn-download" title="Baixar">
            <i class="fa-solid fa-download"></i>
        </a>
    `;
    const whatsappBtn = `
        <a href="https://wa.me/?text=${encodeURIComponent('Factura ' + (invoice.invoiceNumber||'') + ' — ' + formatAmount(invoice.totalAmount) + ' MZN. Ver: ' + window.location.origin + '/p/' + invoice._id)}" class="btn btn-success btn-sm" target="_blank" title="WhatsApp">
            <i class="fab fa-whatsapp"></i>
        </a>
    `;
    const duplicateBtn = `
        <button class="btn btn-info btn-sm btn-duplicate-invoice" data-id="${invoice._id}" title="Duplicar">
            <i class="fa-solid fa-copy"></i>
        </button>
    `;
    const cancelBtn = `
        <button class="btn btn-dark btn-sm btn-cancel-invoice" data-id="${invoice._id}" data-number="${invoice.invoiceNumber || ''}" title="Anular (Nota de Crédito)">
            <i class="fa-solid fa-ban"></i>
        </button>
    `;

    const payPartialBtn = (invoice.status === 'unpaid' || invoice.status === 'partial' || invoice.status === 'overdue') ? `
        <button class="btn btn-warning btn-sm btn-partial-payment" data-id="${invoice._id}" data-number="${invoice.invoiceNumber || ''}" data-total="${invoice.totalAmount}" data-paid="${invoice.paidAmount || 0}" title="Registar pagamento parcial">
            <i class="fa-solid fa-money-bill-wave"></i>
        </button>
    ` : '';

    if (invoice.status === 'cancelled') {
        return `
            <div class="d-flex justify-content-center align-items-center" style="gap:6px;">
                ${downloadBtn}
                <span class="badge badge-dark">Anulada</span>
            </div>
        `;
    }

    if (invoice.status === 'paid') {
        return `
            <div class="d-flex justify-content-center align-items-center" style="gap:6px;">
                ${downloadBtn}${whatsappBtn}${duplicateBtn}${cancelBtn}
                <span class="badge badge-success">Pago</span>
            </div>
        `;
    }

    return `
        <div class="d-flex justify-content-center align-items-center" style="gap:6px;">
            ${downloadBtn}${whatsappBtn}${duplicateBtn}${payPartialBtn}${cancelBtn}
            <button
                type="button"
                class="btn btn-success btn-sm btn-mark-paid"
                data-id="${invoice._id}"
                data-number="${invoice.invoiceNumber || ''}"
                data-status="${invoice.status}"
                title="Marcar como pago (total)"
            >
                <i class="fa-solid fa-circle-check"></i>
            </button>
        </div>
    `;
}

function showToast(icon, title) {
    Swal.fire({
        toast: true,
        position: 'top-end',
        icon,
        title,
        showConfirmButton: false,
        timer: 1800,
        timerProgressBar: true
    });
}

fetch('/api/invoices')
    .then(response => response.json())
    .then(data => {
        data.invoices.forEach(invoice => {
            const actualArray = [
                invoice.invoiceNumber || '—',
                invoice.clientName || '—',
                formatAmount(invoice.totalAmount),
                invoice.date ? new Date(invoice.date).toLocaleDateString() : '—',
                statusBadge(invoice.status),
                actionButtons(invoice)
            ];

            table.row.add(actualArray).draw(false);
        });
    })
    .catch(error => {
        console.error('Error fetching invoices:', error);
        Swal.fire({
            icon: 'error',
            title: 'Erro',
            text: 'Não foi possível carregar as facturas.'
        });
    });

$('#dataTable').on('click', '.btn-download', function (e) {
    e.preventDefault();

    const btn = $(this);
    btn.attr('disabled', true);
    btn.find('i')
        .removeClass('fa-solid fa-download')
        .addClass('fa-solid fa-spinner fa-spin');

    const uri = btn.attr('href');

    fetch(uri)
        .then(response => {
            if (!response.ok) {
                throw new Error('Falha ao baixar factura');
            }
            return response.blob();
        })
        .then(blob => {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'factura.pdf';
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        })
        .catch(error => {
            console.error('Error downloading invoice:', error);
            Swal.fire({
                icon: 'error',
                title: 'Erro',
                text: 'Não foi possível baixar a factura.'
            });
        })
        .finally(() => {
            btn.attr('disabled', false);
            btn.find('i')
                .removeClass('fa-solid fa-spinner fa-spin')
                .addClass('fa-solid fa-download');
        });
});

$('#dataTable').on('click', '.btn-mark-paid', function () {
    selectedRow = $(this).closest('tr');

    const invoiceId = $(this).data('id');
    const invoiceNumber = $(this).data('number') || '—';

    document.getElementById('invoiceId').value = invoiceId;
    document.getElementById('invoiceStatus').value = 'paid';
    document.getElementById('invoiceNumberLabel').innerText = invoiceNumber;

    $('#invoiceStatusModal').modal('show');
});

document.getElementById('btn-save-status').addEventListener('click', function (e) {
    e.preventDefault();

    const btn = this;
    const invoiceId = document.getElementById('invoiceId').value;
    const data = $("#status-form").serialize();

    btn.disabled = true;
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i>A confirmar...';

    fetch(`/api/invoices/${invoiceId}`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: data
    })
        .then(response => response.json())
        .then(data => {
            if (!data.success) {
                throw new Error(data.message || 'Erro ao actualizar factura.');
            }

            $('#invoiceStatusModal').modal('hide');

            selectedRow.find('td:eq(4)').html(statusBadge(data.invoiceStatus));

            const invoiceDownloadBtn = selectedRow.find('.btn-download').prop('outerHTML');

            selectedRow.find('td:eq(5)').html(`
                <div class="d-flex justify-content-center align-items-center" style="gap:6px;">
                    ${invoiceDownloadBtn}
                    ${data.receipt?.pdfUrl ? `
                        <a href="${data.receipt.pdfUrl}" class="btn btn-success btn-sm btn-download-receipt" title="Baixar recibo">
                            <i class="fa-solid fa-file-invoice"></i>
                        </a>
                    ` : ''}
                    <span class="badge badge-success">Pago</span>
                </div>
            `);

            if (data.receipt?.pdfUrl) {
                Swal.fire({
                    icon: 'success',
                    title: 'Pagamento confirmado',
                    html: `
                        <p class="mb-2">A factura foi marcada como <strong>paga</strong>.</p>
                        <p class="mb-0">Recibo gerado: <strong>${data.receipt.receiptNumber}</strong></p>
                    `,
                    showCancelButton: true,
                    confirmButtonText: '<i class="fa-solid fa-download mr-1"></i> Baixar recibo',
                    cancelButtonText: 'Fechar'
                }).then((result) => {
                    if (result.isConfirmed) {
                        Swal.fire({
                            title: 'A baixar recibo...',
                            html: 'Por favor aguarde.',
                            allowOutsideClick: false,
                            allowEscapeKey: false,
                            showConfirmButton: false,
                            didOpen: async () => {
                                Swal.showLoading();

                                try {
                                    await downloadFile(
                                        data.receipt.pdfUrl,
                                        `recibo-${data.receipt.receiptNumber || 'documento'}.pdf`
                                    );
                                    Swal.close();
                                } catch (error) {
                                    Swal.fire({
                                        icon: 'error',
                                        title: 'Erro',
                                        text: 'Não foi possível baixar o recibo.'
                                    });
                                }
                            }
                        });
                    }
                });
            } else {
                Swal.fire({
                    icon: 'success',
                    title: 'Pagamento confirmado',
                    text: 'A factura foi marcada como paga com sucesso.'
                });
            }
        })
        .catch(error => {
            console.error('Error:', error);
            Swal.fire({
                icon: 'error',
                title: 'Erro',
                text: error.message || 'Erro ao actualizar factura. Tente novamente.'
            });
        })
        .finally(() => {
            btn.disabled = false;
            btn.innerHTML = originalHtml;
        });
});
document.getElementById("btn-export").addEventListener("click", async function (e) {
    e.preventDefault();

    try {
        const response = await fetch("/api/invoices/export/excel/false", {
            method: "GET",
        });

        if (!response.ok) {
            throw new Error("Erro ao gerar extrato");
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = "extrato-facturas.xlsx";
        document.body.appendChild(a);
        a.click();

        a.remove();
        window.URL.revokeObjectURL(url);
    } catch (error) {
        console.error(error);
        Swal.fire({
            icon: "error",
            title: "Erro",
            text: "Não foi possível baixar o extrato"
        });
    }
});

// Duplicate invoice
$('#dataTable').on('click', '.btn-duplicate-invoice', async function () {
    const id = $(this).data('id');
    if (!confirm('Duplicar esta factura?')) return;
    try {
        const res = await fetch(`/api/invoices/${id}/duplicate`, { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            showToast('success', 'Factura duplicada!');
            setTimeout(() => window.location.reload(), 1000);
        } else {
            showToast('error', data.message || 'Erro ao duplicar.');
        }
    } catch (e) { showToast('error', 'Erro de ligação.'); }
});

// Partial payment
$('#dataTable').on('click', '.btn-partial-payment', async function () {
    const id = $(this).data('id');
    const number = $(this).data('number');
    const total = parseFloat($(this).data('total')) || 0;
    const paid = parseFloat($(this).data('paid')) || 0;
    const remaining = (total - paid).toFixed(2);

    const result = await Swal.fire({
        title: 'Registar pagamento',
        html: `
            <p class="small">Factura <strong>${number}</strong></p>
            <p class="small text-muted">Total: ${formatAmount(total)} MZN | Pago: ${formatAmount(paid)} MZN | <strong>Faltam: ${formatAmount(remaining)} MZN</strong></p>
            <div class="form-group text-left">
                <label class="small font-weight-bold">Valor do pagamento (MZN)</label>
                <input type="number" id="swalPayAmount" class="form-control" step="0.01" min="0.01" max="${remaining}" value="${remaining}" />
            </div>
            <div class="form-group text-left">
                <label class="small font-weight-bold">Método</label>
                <select id="swalPayMethod" class="form-control form-control-sm">
                    <option value="cash">Dinheiro</option>
                    <option value="mpesa">M-Pesa</option>
                    <option value="emola">E-mola</option>
                    <option value="bank">Transferência</option>
                    <option value="card">Cartão</option>
                </select>
            </div>
            <div class="form-group text-left">
                <label class="small font-weight-bold">Referência (opcional)</label>
                <input type="text" id="swalPayRef" class="form-control form-control-sm" placeholder="Nº transacção..." />
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: '<i class="fa-solid fa-money-bill-wave mr-1"></i> Registar',
        cancelButtonText: 'Cancelar',
        preConfirm: () => {
            const amount = parseFloat(document.getElementById('swalPayAmount').value);
            if (!amount || amount <= 0) { Swal.showValidationMessage('Valor inválido.'); return false; }
            if (amount > parseFloat(remaining) + 0.01) { Swal.showValidationMessage('Excede o saldo devedor.'); return false; }
            return {
                amount,
                paymentMethod: document.getElementById('swalPayMethod').value,
                reference: document.getElementById('swalPayRef').value
            };
        }
    });

    if (!result.isConfirmed) return;

    try {
        const res = await fetch('/api/features/payments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ invoiceId: id, ...result.value })
        });
        const data = await res.json();
        if (data.success) {
            const dlResult = await Swal.fire({
                icon: 'success',
                title: 'Pagamento registado',
                html: `<p>${data.message}</p><p class="small text-muted">Recibo: <strong>${data.receiptNumber || ''}</strong></p>`,
                showCancelButton: true,
                confirmButtonText: '<i class="fa-solid fa-download mr-1"></i> Baixar recibo',
                cancelButtonText: 'Fechar'
            });
            if (dlResult.isConfirmed && data.downloadUrl) {
                await downloadFile(data.downloadUrl, `recibo-${data.receiptNumber || 'pagamento'}.pdf`);
            }
            window.location.reload();
        } else {
            Swal.fire({ icon: 'error', title: 'Erro', text: data.message });
        }
    } catch (e) {
        Swal.fire({ icon: 'error', title: 'Erro', text: 'Erro de ligação.' });
    }
});

// Cancel invoice (emit credit note)
$('#dataTable').on('click', '.btn-cancel-invoice', async function () {
    const id = $(this).data('id');
    const number = $(this).data('number') || '—';

    const result = await Swal.fire({
        icon: 'warning',
        title: 'Anular factura',
        html: `
            <p>Vai emitir uma <strong>Nota de Crédito</strong> para anular a factura <strong>${number}</strong>.</p>
            <p class="small text-muted">A factura não será eliminada — ficará com estado "Anulada" e a NC fica registada para efeitos fiscais.</p>
            <div class="form-group text-left mt-3">
                <label class="small font-weight-bold">Motivo da anulação *</label>
                <select class="form-control form-control-sm" id="swalCancelReason">
                    <option value="">Seleccione...</option>
                    <option value="Erro nos dados do cliente">Erro nos dados do cliente</option>
                    <option value="Erro nos itens/valores">Erro nos itens/valores</option>
                    <option value="Devolução de mercadoria">Devolução de mercadoria</option>
                    <option value="Factura duplicada">Factura duplicada</option>
                    <option value="Desistência do cliente">Desistência do cliente</option>
                    <option value="Outro">Outro</option>
                </select>
                <input type="text" class="form-control form-control-sm mt-2" id="swalCancelReasonCustom" placeholder="Especifique o motivo..." style="display:none;" />
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: '<i class="fa-solid fa-file-circle-minus mr-1"></i> Emitir Nota de Crédito',
        confirmButtonColor: '#333',
        cancelButtonText: 'Cancelar',
        didOpen: () => {
            document.getElementById('swalCancelReason').addEventListener('change', function() {
                document.getElementById('swalCancelReasonCustom').style.display = this.value === 'Outro' ? '' : 'none';
            });
        },
        preConfirm: () => {
            const sel = document.getElementById('swalCancelReason').value;
            const custom = document.getElementById('swalCancelReasonCustom').value.trim();
            const reason = sel === 'Outro' ? (custom || 'Outro') : sel;
            if (!reason) {
                Swal.showValidationMessage('Seleccione um motivo.');
                return false;
            }
            return reason;
        }
    });

    if (!result.isConfirmed) return;

    try {
        const res = await fetch('/api/invoices/credit-note', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ invoiceId: id, reason: result.value })
        });
        const data = await res.json();
        if (data.success) {
            const dlResult = await Swal.fire({
                icon: 'success',
                title: 'Factura anulada',
                html: `<p>${data.message}</p>`,
                showCancelButton: true,
                confirmButtonText: '<i class="fa-solid fa-download mr-1"></i> Baixar NC',
                cancelButtonText: 'Fechar'
            });
            if (dlResult.isConfirmed && data.downloadUrl) {
                await downloadFile(data.downloadUrl, `nota-credito-${data.creditNote.invoiceNumber}.pdf`);
            }
            setTimeout(() => window.location.reload(), 500);
        } else {
            Swal.fire({ icon: 'error', title: 'Erro', text: data.message });
        }
    } catch (e) {
        Swal.fire({ icon: 'error', title: 'Erro', text: 'Erro de ligação.' });
    }
});

async function downloadFile(url, filename = 'recibo.pdf') {
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error('Não foi possível baixar o ficheiro');
    }

    const blob = await response.blob();
    const objectUrl = window.URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();

    window.URL.revokeObjectURL(objectUrl);
}

