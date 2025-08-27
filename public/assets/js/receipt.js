let selectedRow = null;
fetch('/api/recibos')
    .then(response => response.json())
    .then(data => {
        data.recibos.forEach(invoice => {
            const actualArray = [invoice.reciboNumber, invoice.clientName, invoice.totalAmount, new Date(invoice.date).toLocaleDateString(), `<a href="/api/recibos/${invoice._id}/pdf" class="btn btn-primary btn-sm text-center btn-download"><i class="fa-solid fa-download"></i></a>
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
            a.download =  `recibo-${invoiceNumber}.pdf`;
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