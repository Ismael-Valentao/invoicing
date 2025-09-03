let selectedRow = null;
fetch('/api/quotations')
    .then(response => response.json())
    .then(data => {
        data.quotations.forEach(quotation => {
            const actualArray = [quotation.quotationNumber, quotation.clientName, quotation.totalAmount, new Date(quotation.date).toLocaleDateString(), `<a href="/api/quotations/${quotation._id}/pdf" class="btn btn-primary btn-sm text-center btn-download"><i class="fa-solid fa-download"></i></a>`];
            $('#dataTable').DataTable().row.add(actualArray).draw(false);
        });
    })
    .catch(error => console.error('Error fetching quotations:', error));


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