const statusBadge = (status) => {
    switch (status) {
        case 'paid':
            return '<span class="badge badge-success p-1 w-100">Pago</span>';
        case 'unpaid':
            return '<span class="badge badge-warning p-1 w-100">Pendente</span>';
        case 'overdue':
            return '<span class="badge badge-danger p- w-100">Vencido</span>';
        default:
            return '<span class="badge badge-secondary p-1 w-100">Desconhecido</span>';
    }
}
let selectedRow = null;
fetch('/api/invoices')
    .then(response => response.json())
    .then(data => {
        data.invoices.forEach(invoice => {
            const actualArray = [invoice.invoiceNumber, invoice.clientName, invoice.totalAmount, new Date(invoice.date).toLocaleDateString(), statusBadge(invoice.status), `<a href="/api/invoices/${invoice._id}/pdf" class="btn btn-primary btn-sm text-center btn-download"><i class="fa-solid fa-download"></i></a>
            <button type="button" class="btn btn-secondary btn-sm mx-2 btn-edit-invoice" id="${invoice._id}" stat="${invoice.status}"><i class="fa-solid fa-pen-to-square"></i></button>`];
            $('#dataTable').DataTable().row.add(actualArray).draw(false);
        });
    })
    .catch(error => console.error('Error fetching invoices:', error));

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
            a.download = 'factura.pdf';
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

$('#dataTable').on('click', '.btn-edit-invoice', function () {
    selectedRow = $(this).closest('tr');
    const invoiceId = $(this).attr('id');
    const invoiceStatus = $(this).attr('stat');
    const invoiceStatusText = invoiceStatus === 'paid' ? 'Unpaid' : 'Paid';
    const invoiceStatusPT = $(this).attr('stat') === 'paid' ? 'Pendente' : 'Pago';

    document.getElementById('invoiceId').value = invoiceId;
    document.getElementById('invoiceStatus').value = invoiceStatusText;
    document.getElementById('invoiceStatusPT').innerText = invoiceStatusPT;

    $('#invoiceStatusModal').modal('show');
})

document.getElementById('btn-save-status').addEventListener('click', function (e) {
    e.preventDefault();
    const invoiceId = document.getElementById('invoiceId').value;
    const data = $("#status-form").serialize();

    fetch(`/api/invoices/${invoiceId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: data
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                $('#invoiceStatusModal').modal('hide');
                selectedRow.find('td:eq(4)').html(statusBadge(data.invoiceStatus));
                selectedRow.find('button.btn-edit-invoice').attr('stat', data.invoiceStatus);
            } else {
                alert('Erro ao actualizar factura: ' + data.message);
                $('#invoiceStatusModal').modal('hide');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Erro ao actualizar factura. Tente novamente.');
        });
})