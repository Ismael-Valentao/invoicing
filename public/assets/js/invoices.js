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
        <a href="/api/invoices/${invoice._id}/pdf" class="btn btn-primary btn-sm text-center btn-download" title="Baixar factura">
            <i class="fa-solid fa-download"></i>
        </a>
    `;

    if (invoice.status === 'paid') {
        return `
            <div class="d-flex justify-content-center align-items-center" style="gap:6px;">
                ${downloadBtn}
                <span class="badge badge-success">Pago</span>
            </div>
        `;
    }

    return `
        <div class="d-flex justify-content-center align-items-center" style="gap:6px;">
            ${downloadBtn}
            <button 
                type="button"
                class="btn btn-success btn-sm btn-mark-paid"
                data-id="${invoice._id}"
                data-number="${invoice.invoiceNumber || ''}"
                data-status="${invoice.status}"
                title="Marcar como pago"
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

