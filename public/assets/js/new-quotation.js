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

$("#quotation-form").submit(function(e){
    e.preventDefault();
    const data = $(this).serialize();
    
    fetch('/api/quotations', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: data
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert('Cotação criada com sucesso!');
            //window.location.href = '/quotations';
        } else {
            alert('Erro ao criar cotação: ' + data.message);
        }
    }).catch(error => {
        console.error('Error:', error);
        alert('Erro ao criar cotação. Tente novamente.');
    });
})

const updateNumeration = ()=>{
    const inputNumeration = document.getElementById('quotationNumber');
    const newNumeration = (dinputNumeration.value*1 + 1).toString().padStart(6, '0');
    inputNumeration.value = newNumeration;             
}

const getLastQuotationNumber = async ()=>{
    const response = await fetch('/api/quotations/last-quotation');
    const data = await response.json();
    if(data.success){
        console.log(data)
        const lastQuotationNumber = data.lastQuotation;
        const newQuotationNumber = (lastQuotationNumber*1 + 1).toString().padStart(4, 0);
        document.getElementById('quotationNumber').value = newQuotationNumber; 
    }else{
        alert('Erro ao obter o número da última cotação: ' + data.message);
    }
}
getLastQuotationNumber();
