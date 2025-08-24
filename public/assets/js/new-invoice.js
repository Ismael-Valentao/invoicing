let rowIndex = 1;
let selectedRow = null;
$('#addRow').click(function () {
    $('#itemsTable tbody').append(`
         <tr>
            <td class="d-flex"><input type="text" name="items[${rowIndex}][description]" class="form-control form-control-sm description" required> <button type="button" class="btn btn-primary btn-sm ml-3 d-flex align-items-center btn-open-products-list"><i class="fa-solid fa-table-list mr-2"></i> Selecionar</button></td>
            <td><input type="number" name="items[${rowIndex}][quantity]" value="1" min="1" class="form-control form-control-sm quantity" required></td>
            <td><input type="number" name="items[${rowIndex}][unitPrice]" min="1" placeholder="0" class="form-control form-control-sm unitPrice" required></td>
            <td><button type="button" class="btn btn-danger btn-sm remove-row"><i class="fas fa-trash"></i></button></td>
        </tr>
    `);
    rowIndex++;
});

$('#itemsTable').on('click', '.remove-row', function () {
    $(this).closest('tr').remove();
});

$('#itemsTable').on('click', '.btn-open-products-list', function () {
    $('#productSelectModal').modal('show');
})

$("#invoice-form").submit(function (e) {
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
                Swal.fire({
                    icon: 'success',
                    title: 'Sucesso!',
                    text: 'Factura criada...',
                    showConfirmButton: true,
                    confirmButtonText: 'OK'
                })
                updateNumeration();
            } else {
                Swal.fire({
                    icon: 'error',
                    title: 'Erro!',
                    text: data.message,
                    showConfirmButton: true,
                    confirmButtonText: 'OK'
                })
            }
        }).catch(error => {
            console.log('Error:', error);
            Swal.fire({
                icon: 'error',
                title: 'Erro!',
                text: 'Erro ao criar a factura. Tente novamente mais tarde.',
                showConfirmButton: true,
                confirmButtonText: 'OK'
            })
        });
})

const updateNumeration = () => {
    const inputNumeration = document.getElementById('invoiceNumber');
    const newNumeration = (inputNumeration.value * 1 + 1).toString().padStart(6, '0');
    inputNumeration.value = newNumeration;
}

const getLastInvoiceNumber = async () => {
    const response = await fetch('/api/invoices/last-invoice');
    const data = await response.json();
    if (data.success) {
        console.log(data)
        const lastInvoiceNumber = data.lastInvoice;
        const newInvoiceNumber = (lastInvoiceNumber * 1 + 1).toString().padStart(4, 0);
        document.getElementById('invoiceNumber').value = newInvoiceNumber;
    } else {
        alert('Erro ao obter o número da última factura: ' + data.message);
    }
}

async function getProducts() {
    fetch('/api/products')
        .then(response => response.json())
        .then(data => {
            if (data.status === "success" && data.products.length > 0) {
                const products = data.products;
                const productSelect = document.createElement('select');
                productSelect.className = 'form-control form-control-sm';
                productSelect.innerHTML =`<option value="0">Selecionar</option>` + products.map(product => `<option value="${product.unitPrice}">${product.description}</option>`).join('');
                $('#productSelectModal .modal-body').empty().html(productSelect);
            }
        })
}

async function getClients() {
    fetch('/api/clients')
        .then(response => response.json())
        .then(data => {

            if (data.status === "success" && data.clients.length > 0) {
                const clients = data.clients;
                console.log(clients)
                let clientsOptions = clients.map(client => `<option value="${client.nuit}">${client.name}</option>`).join('');
                $('#client-select').append(clientsOptions);
            }
        })
}

async function updateDate(){
    const inputDate = document.querySelector('input[name="date"]');
    const today = new Date().toISOString().split('T')[0];
    inputDate.value = today;
}

$('#productSelectModal').on('change', 'select', function () {
    if($(this).val() == 0){
        $('#productSelectModal').modal('hide');
        return
    }
    const selectedOption = $(this).find('option:selected');
    const unitPrice = selectedOption.val();
    const description = selectedOption.text();
    const quantity = 1; // Default quantity

    selectedRow.find('input.description').val(description);
    selectedRow.find('input.unitPrice').val(unitPrice);
    selectedRow.find('input.quantity').val(quantity);
    $('#productSelectModal').modal('hide');
});

$("#client-select").on("change", function (e) {
    const selectedOption = $(this).find('option:selected');
    const companyName = selectedOption.text();
    const companyNUIT = selectedOption.val();
    $("#companyName").val(companyName);
    $("#clientName").val(companyName);
    $("#clientNUIT").val(companyNUIT);
})

$('.table').on('click', '.btn-open-products-list', function () {
    const row = $(this).closest('tr');
    selectedRow = row;
});

document.addEventListener('DOMContentLoaded', function () {
    getLastInvoiceNumber();
    getProducts();
    getClients();
    updateDate();
})