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
fetch('/api/vd')
    .then(response => response.json())
    .then(data => {
        data.vds.forEach(vd => {
            const actualArray = [vd.invoiceNumber, vd.clientName, vd.totalAmount, new Date(vd.date).toLocaleDateString(), statusBadge(vd.status), `<a href="http://localhost:3000/api/vd/${vd._id}/pdf" class="btn btn-primary btn-sm text-center btn-download"><i class="fa-solid fa-download"></i></a>
            `];
            $('#dataTable').DataTable().row.add(actualArray).draw(false);
        });
    })
    .catch(error => console.error('Error fetching invoices:', error));

$('#dataTable').on('click', '.btn-download', function (e) {
    e.preventDefault();
    const btn = $(this);
    selectedRow = $(this).closest('tr');
    const invoiceNumber = selectedRow.find('td').eq(0).text().trim();
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
            a.download =  `VD-${invoiceNumber}.pdf`;
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