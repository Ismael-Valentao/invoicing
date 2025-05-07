let selectedRow = null;
fetch('/api/quotations')
    .then(response => response.json())
    .then(data => {
        data.quotations.forEach(quotation => {
            const actualArray = [quotation.quotationNumber, quotation.clientName, quotation.totalAmount, new Date(quotation.date).toLocaleDateString(), `<a href="http://localhost:3000/api/quotations/${quotation._id}/pdf" class="btn btn-primary btn-sm text-center"><i class="fa-solid fa-download"></i></a>`];
            $('#dataTable').DataTable().row.add(actualArray).draw(false);
        });
    })
    .catch(error => console.error('Error fetching quotations:', error));