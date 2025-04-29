(()=>{
    const inputDate = document.querySelector('input[name="date"]');
    const today = new Date().toISOString().split('T')[0];
    inputDate.value = today;             
})();

let rowIndex = 1;
$('#addRow').click(function () {
    $('#itemsTable tbody').append(`
        <tr>
            <td><input type="text" name="items[${rowIndex}][description]" class="form-control form-control-sm" required></td>
            <td><input type="number" name="items[${rowIndex}][quantity]" class="form-control form-control-sm" required></td>
            <td><input type="number" name="items[${rowIndex}][unitPrice]" class="form-control form-control-sm" required></td>
            <td><button type="button" class="btn btn-danger btn-sm remove-row"><i class="fas fa-trash"></i></button></td>
        </tr>
    `);
    rowIndex++;
});

$('#itemsTable').on('click', '.remove-row', function () {
    $(this).closest('tr').remove();
});

$("#invoice-form").submit(function(e){
    e.preventDefault();
    const data = $(this).serialize();
    
    fetch('/api/invoices', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: data
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert('Factura criada com sucesso!');
            //window.location.href = '/invoices';
        } else {
            alert('Erro ao criar factura: ' + data.message);
        }
    }).catch(error => {
        console.error('Error:', error);
        alert('Erro ao criar factura. Tente novamente.');
    });
})

const updateNumeration = ()=>{
    const inputNumeration = document.getElementById('invoiceNumber');
    const newNumeration = (dinputNumeration.value*1 + 1).toString().padStart(6, '0');
    inputNumeration.value = newNumeration;             
}

const getLastInvoiceNumber = async ()=>{
    const response = await fetch('/api/invoices/last-invoice');
    const data = await response.json();
    if(data.success){
        console.log(data)
        const lastInvoiceNumber = data.lastInvoice;
        const newInvoiceNumber = (lastInvoiceNumber*1 + 1).toString().padStart(4, 0);
        document.getElementById('invoiceNumber').value = newInvoiceNumber; 
    }else{
        alert('Erro ao obter o número da última factura: ' + data.message);
    }
}
getLastInvoiceNumber();
