let rowIndex = 1;
let selectedRow = null;
$('#addRow').click(function () {
    $('#itemsTable tbody').append(`
         <tr>
            <td class="d-flex"><input type="text" name="items[${rowIndex}][description]" class="form-control form-control-sm description" required> <button type="button" class="btn btn-primary btn-sm ml-3 d-flex align-items-center btn-open-products-list"><i class="fa-solid fa-table-list mr-2"></i> Selecionar</button></td>
            <td><input type="number" name="items[${rowIndex}][quantity]" value="1" min="1" class="form-control form-control-sm quantity" required></td>
            <td><input type="text" name="items[${rowIndex}][unitPrice]" min="1" placeholder="0" class="form-control form-control-sm unitPrice" required></td>
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

$("#invoice-form").submit(async function (e) {
    e.preventDefault();

    const form = this;
    const data = $(form).serialize();
    const submitBtn = $(form).find('button[type="submit"]');

    const originalHtml = submitBtn.html();
    submitBtn.prop('disabled', true).html('<i class="fa-solid fa-spinner fa-spin mr-1"></i>A criar...');

    try {
        const response = await fetch('/api/invoices', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: data
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || 'Erro ao criar a factura.');
        }

        const invoiceNumber = result.invoice?.invoiceNumber || document.getElementById('invoiceNumber').value;

        const swalResult = await Swal.fire({
            icon: 'success',
            title: 'Factura criada',
            html: `
                <p class="mb-2">
                    A factura <strong>${invoiceNumber}</strong> foi criada com sucesso.
                </p>
                <p class="mb-0">Deseja baixar a factura agora?</p>
            `,
            showDenyButton: true,
            showCancelButton: true,
            confirmButtonText: '<i class="fa-solid fa-download mr-1"></i> Baixar factura',
            denyButtonText: 'Ver lista',
            cancelButtonText: 'Continuar aqui'
        });

        if (swalResult.isConfirmed) {
            Swal.fire({
                title: 'A baixar factura...',
                html: 'Por favor aguarde.',
                allowOutsideClick: false,
                allowEscapeKey: false,
                showConfirmButton: false
            });

            Swal.showLoading();

            try {
                await downloadFile(
                    result.downloadUrl,
                    `factura-${invoiceNumber}.pdf`
                );

                Swal.close();

                try {
                    const countResponse = await fetch('/api/invoices/total-invoices');
                    const countData = await countResponse.json();
                    

                    if (countData.success) {
                        await maybeShowSharePrompt(countData.totalInvoices);
                    }
                } catch (err) {
                    console.error('Erro ao verificar total de facturas:', err);
                }
            } catch (error) {
                Swal.fire({
                    icon: 'error',
                    title: 'Erro',
                    text: 'A factura foi criada, mas não foi possível baixá-la.'
                });
            }

            return;
        }

        if (swalResult.isDenied) {
            try {
                const countResponse = await fetch('/api/invoices/total-invoices');
                const countData = await countResponse.json();
                

                if (countData.success) {
                    await maybeShowSharePrompt(countData.totalInvoices);
                }
            } catch (err) {
                console.error('Erro ao verificar total de facturas:', err);
            }

            window.location.href = '/invoices';
            return;
        }

        form.reset();
        $('#itemsTable tbody').html(`
            <tr>
                <td class="d-flex">
                    <input type="text" name="items[0][description]" class="form-control form-control-sm description" required>
                    <button type="button" class="btn btn-primary btn-sm ml-3 d-flex align-items-center btn-open-products-list">
                        <i class="fa-solid fa-table-list mr-2"></i> Selecionar
                    </button>
                </td>
                <td><input type="number" name="items[0][quantity]" value="1" min="1" class="form-control form-control-sm quantity" required></td>
                <td><input type="text" name="items[0][unitPrice]" min="1" placeholder="0" class="form-control form-control-sm unitPrice" required></td>
                <td><button type="button" class="btn btn-danger btn-sm remove-row"><i class="fas fa-trash"></i></button></td>
            </tr>
        `);

        rowIndex = 1;
        updateDate();
        getLastInvoiceNumber();
        $("#clientName").val("");
        $("#clientNUIT").val("");
        $("#clientId").val("");
        $("#client-select").val("");

        try {
            const countResponse = await fetch('/api/invoices/total-invoices');
            const countData = await countResponse.json();
            console.log(countData);

            if (countData.success) {
                await maybeShowSharePrompt(countData.totalInvoices);
            }
        } catch (err) {
            console.error('Erro ao verificar total de facturas:', err);
        }

    } catch (error) {
        console.log('Error:', error);
        Swal.fire({
            icon: 'error',
            title: 'Erro!',
            text: error.message || 'Erro ao criar a factura. Tente novamente mais tarde.',
            showConfirmButton: true,
            confirmButtonText: 'OK'
        });
    } finally {
        form.reset();
        submitBtn.prop('disabled', false).html(originalHtml);
    }
});

const updateNumeration = () => {
    const inputNumeration = document.getElementById('invoiceNumber');
    const newNumeration = (inputNumeration.value * 1 + 1).toString().padStart(6, '0');
    inputNumeration.value = newNumeration;
}

const getLastInvoiceNumber = async () => {
    const response = await fetch('/api/invoices/last-invoice');
    const data = await response.json();
    if (data.success) {
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
                productSelect.innerHTML = `<option value="0">Selecionar</option>` + products.map(product => `<option value="${product.unitPrice}">${product.description}</option>`).join('');
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
                let clientsOptions = clients.map(client => `<option data-id="${client._id}" value="${client.nuit}">${client.name}</option>`).join('');
                $('#client-select').append(clientsOptions);
            }
        })
}

async function updateDate() {
    const inputDate = document.querySelector('input[name="date"]');
    const today = new Date().toISOString().split('T')[0];
    inputDate.value = today;
}

$('#productSelectModal').on('change', 'select', function () {
    if ($(this).val() == 0) {
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
    $("#clientId").val(selectedOption.attr("data-id"))
})

$('.table').on('click', '.btn-open-products-list', function () {
    const row = $(this).closest('tr');
    selectedRow = row;
});

async function downloadFile(url, filename = 'factura.pdf') {
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

document.addEventListener('DOMContentLoaded', function () {
    getLastInvoiceNumber();
    getProducts();
    getClients();
    updateDate();
})

function shareOnWhatsApp() {
    const text = encodeURIComponent(
        "Estou a usar o Invoicing para gerir vendas, stock e facturação. Recomendo: https://invoicing-h19p.onrender.com"
    );

    window.open(`https://wa.me/?text=${text}`, "_blank");
}

async function maybeShowSharePrompt(invoiceCount) {
    const alreadyShown = localStorage.getItem("invoicing_share_prompt_shown");
    console.log(alreadyShown);

    if (alreadyShown === "true") return;
    if (invoiceCount < 3) return;

    const result = await Swal.fire({
        icon: "info",
        title: "Está a gostar do Invoicing?",
        text: "Ajude outros negócios a descobrirem a plataforma.",
        showCancelButton: true,
        confirmButtonText: '<i class="fa-brands fa-whatsapp mr-1"></i> Partilhar',
        cancelButtonText: "Agora não"
    });

    if (result.isConfirmed) {
        shareOnWhatsApp();
    }

    localStorage.setItem("invoicing_share_prompt_shown", "true");
}