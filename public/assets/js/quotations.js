let selectedRow = null;
const table = $('#dataTable').DataTable();
function formatAmount(value) {
    const amount = Number(value || 0);
    return amount.toLocaleString('pt-PT', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function quotationStatusBadge(status) {
    switch (status) {
        case 'approved':
            return '<span class="badge badge-success p-1 w-100">Aprovada</span>';
        case 'converted':
            return '<span class="badge badge-info p-1 w-100">Convertida</span>';
        default:
            return '<span class="badge badge-warning p-1 w-100">Pendente</span>';
    }
}

function actionButtons(quotation) {
    const downloadBtn = `
        <a href="/api/quotations/${quotation._id}/pdf" class="btn btn-primary btn-sm btn-download" title="Baixar cotação">
            <i class="fa-solid fa-download"></i>
        </a>
    `;
    const whatsappBtn = `
        <a href="https://wa.me/?text=${encodeURIComponent('Cotação ' + (quotation.quotationNumber||'') + ' — ' + formatAmount(quotation.totalAmount) + ' MZN. Ver: ' + window.location.origin + '/p/' + quotation._id)}" class="btn btn-success btn-sm" target="_blank" title="WhatsApp">
            <i class="fab fa-whatsapp"></i>
        </a>
    `;
    const duplicateBtn = `
        <button class="btn btn-info btn-sm btn-duplicate-quotation" data-id="${quotation._id}" title="Duplicar">
            <i class="fa-solid fa-copy"></i>
        </button>
    `;

    if (quotation.invoiceId) {
        return `
            <div class="d-flex justify-content-center align-items-center" style="gap:6px;">
                ${downloadBtn}${whatsappBtn}${duplicateBtn}
                <a href="/invoices" class="btn btn-success btn-sm" title="Ver facturas">
                    <i class="fa-solid fa-file-invoice"></i>
                </a>
            </div>
        `;
    }

    return `
        <div class="d-flex justify-content-center align-items-center" style="gap:6px;">
            ${downloadBtn}${whatsappBtn}${duplicateBtn}
            <button
                type="button"
                class="btn btn-success btn-sm btn-approve-quotation"
                data-id="${quotation._id}"
                data-number="${quotation.quotationNumber || ''}"
                title="Aprovar e converter em factura"
            >
                <i class="fa-solid fa-check"></i>
            </button>
        </div>
    `;
}

fetch('/api/quotations')
    .then(response => response.json())
    .then(data => {
        data.quotations.forEach(quotation => {
            const actualArray = [
                quotation.quotationNumber || '—',
                quotation.clientName || '—',
                formatAmount(quotation.totalAmount),
                quotation.date ? new Date(quotation.date).toLocaleDateString() : '—',
                quotationStatusBadge(quotation.status),
                actionButtons(quotation)
            ];

            table.row.add(actualArray).draw(false);
        });
    })
    .catch(error => {
        console.error('Error fetching quotations:', error);
        Swal.fire({
            icon: 'error',
            title: 'Erro',
            text: 'Não foi possível carregar as cotações.'
        });
    });

$('#dataTable').on('click', '.btn-download', function (e) {
    e.preventDefault();
    const btn = $(this);
    btn.attr('disabled', true);
    btn.find('i').removeClass('fa-solid fa-download').addClass('fa-solid fa-spinner fa-spin-pulse');
    const uri = $(this).attr('href');
    fetch(uri)
        .then(response => {
            if (response.ok) {
                return response.blob();
            } else {
                throw new Error('Network response was not ok');
            }
        })
        .then(blob => {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'cotação.pdf';
            document.body.appendChild(a);
            a.click();
            a.remove();

        })
        .finally(() => {
            btn.attr('disabled', false);
            btn.find('i').removeClass('fa-solid fa-spinner fa-spin-pulse').addClass('fa-solid fa-download');
        })
        .catch(error => console.error('Error downloading invoice:', error));
})

$('#dataTable').on('click', '.btn-approve-quotation', async function () {
    const btn = $(this);
    const quotationId = btn.data('id');
    const quotationNumber = btn.data('number') || '—';
    const row = btn.closest('tr');

    const result = await Swal.fire({
        icon: 'question',
        title: 'Aprovar cotação',
        html: `
            <p class="mb-2">
                Deseja aprovar a cotação <strong>${quotationNumber}</strong>?
            </p>
            <p class="mb-0">
                Ao confirmar, será criada automaticamente uma factura com os mesmos dados.
            </p>
        `,
        showCancelButton: true,
        confirmButtonText: '<i class="fa-solid fa-check mr-1"></i> Aprovar e converter',
        cancelButtonText: 'Cancelar'
    });

    if (!result.isConfirmed) return;

    btn.attr('disabled', true);
    btn.find('i').removeClass('fa-check').addClass('fa-spinner fa-spin');

    try {
        const response = await fetch(`/api/quotations/${quotationId}/approve`, {
            method: 'PATCH'
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Erro ao aprovar cotação.');
        }

        row.find('td:eq(4)').html('<span class="badge badge-success p-1 w-100">Aprovada</span>');

        const downloadQuotationBtn = row.find('.btn-download').prop('outerHTML');

        row.find('td:eq(5)').html(`
            <div class="d-flex justify-content-center align-items-center" style="gap:6px;">
                ${downloadQuotationBtn}
                <a href="${data.invoice.pdfUrl}" class="btn btn-success btn-sm btn-download-invoice" title="Baixar factura">
                    <i class="fa-solid fa-file-invoice"></i>
                </a>
                <a href="/invoices" class="btn btn-secondary btn-sm" title="Ver facturas">
                    <i class="fa-solid fa-list"></i>
                </a>
            </div>
        `);

        const successResult = await Swal.fire({
            icon: 'success',
            title: 'Cotação aprovada',
            html: `
                <p class="mb-2">A cotação foi convertida em factura com sucesso.</p>
                <p class="mb-0">Factura criada: <strong>${data.invoice.invoiceNumber}</strong></p>
            `,
            showDenyButton: true,
            showCancelButton: true,
            confirmButtonText: '<i class="fa-solid fa-download mr-1"></i> Baixar factura',
            denyButtonText: 'Ver facturas',
            cancelButtonText: 'Fechar'
        });

        if (successResult.isConfirmed) {
            await downloadFile(
                data.invoice.pdfUrl,
                `factura-${data.invoice.invoiceNumber}.pdf`
            );
        } else if (successResult.isDenied) {
            window.location.href = '/invoices';
        }

    } catch (error) {
        console.error(error);
        Swal.fire({
            icon: 'error',
            title: 'Erro',
            text: error.message || 'Não foi possível aprovar a cotação.'
        });
    } finally {
        btn.attr('disabled', false);
        btn.find('i').removeClass('fa-spinner fa-spin').addClass('fa-check');
    }
});

// Duplicate quotation
$('#dataTable').on('click', '.btn-duplicate-quotation', async function () {
    const id = $(this).data('id');
    if (!confirm('Duplicar esta cotação?')) return;
    try {
        const res = await fetch(`/api/quotations/${id}/duplicate`, { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            Swal.fire({ icon: 'success', title: 'Cotação duplicada!', timer: 1500, showConfirmButton: false });
            setTimeout(() => window.location.reload(), 1000);
        } else {
            Swal.fire({ icon: 'error', title: 'Erro', text: data.message });
        }
    } catch (e) { Swal.fire({ icon: 'error', title: 'Erro', text: 'Erro de ligação.' }); }
});

async function downloadFile(url, filename = 'documento.pdf') {
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