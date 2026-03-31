let rowIndex = 1;
let selectedRow = null;

$('#addRow').click(function () {
    $('#itemsTable tbody').append(`
        <tr>
            <td class="d-flex">
                <input type="text" name="items[${rowIndex}][description]" class="form-control form-control-sm description" required>
                <button type="button" class="btn btn-primary btn-sm ml-3 d-flex align-items-center btn-open-products-list">
                    <i class="fa-solid fa-table-list mr-2"></i> Selecionar
                </button>
            </td>
            <td>
                <input type="number" name="items[${rowIndex}][quantity]" value="1" min="1" class="form-control form-control-sm quantity" required>
            </td>
            <td>
                <input type="text" name="items[${rowIndex}][unitPrice]" min="1" placeholder="0" class="form-control form-control-sm unitPrice" required>
            </td>
            <td>
                <button type="button" class="btn btn-danger btn-sm remove-row">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `);
    rowIndex++;
});

$('#itemsTable').on('click', '.remove-row', function () {
    $(this).closest('tr').remove();
});

$('#itemsTable').on('click', '.btn-open-products-list', function () {
    $('#productSelectModal').modal('show');
});

$("#quotation-form").submit(async function (e) {
    e.preventDefault();

    const form = this;
    const data = $(form).serialize();
    const submitBtn = $(form).find('button[type="submit"]');

    const originalHtml = submitBtn.html();
    submitBtn.prop('disabled', true).html('<i class="fa-solid fa-spinner fa-spin mr-1"></i>A criar...');

    try {
        const response = await fetch('/api/quotations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: data
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || 'Erro ao criar a cotação.');
        }

        const quotationNumber =
            result.quotation?.quotationNumber ||
            document.getElementById('quotationNumber').value;

        const swalResult = await Swal.fire({
            icon: 'success',
            title: 'Cotação criada',
            html: `
                <p class="mb-2">
                    A cotação <strong>${quotationNumber}</strong> foi criada com sucesso.
                </p>
                <p class="mb-0">Deseja baixar a cotação agora?</p>
            `,
            showDenyButton: true,
            showCancelButton: true,
            confirmButtonText: '<i class="fa-solid fa-download mr-1"></i> Baixar cotação',
            denyButtonText: 'Ver cotações',
            cancelButtonText: 'Continuar aqui'
        });

        if (swalResult.isConfirmed) {
            Swal.fire({
                title: 'A baixar cotação...',
                html: 'Por favor aguarde.',
                allowOutsideClick: false,
                allowEscapeKey: false,
                showConfirmButton: false
            });

            Swal.showLoading();

            try {
                await downloadFile(
                    result.downloadUrl,
                    `cotacao-${quotationNumber}.pdf`
                );

                Swal.close();
            } catch (error) {
                Swal.fire({
                    icon: 'error',
                    title: 'Erro',
                    text: 'A cotação foi criada, mas não foi possível baixá-la.'
                });
            }

            return;
        }

        if (swalResult.isDenied) {
            window.location.href = '/quotations';
            return;
        }

        $('#itemsTable tbody').html(`
            <tr>
                <td class="d-flex">
                    <input type="text" name="items[0][description]" class="form-control form-control-sm description" required>
                    <button type="button" class="btn btn-primary btn-sm ml-3 d-flex align-items-center btn-open-products-list">
                        <i class="fa-solid fa-table-list mr-2"></i> Selecionar
                    </button>
                </td>
                <td>
                    <input value="1" min="1" type="number" name="items[0][quantity]" class="form-control form-control-sm quantity" required>
                </td>
                <td>
                    <input type="text" min="0" name="items[0][unitPrice]" class="form-control form-control-sm unitPrice" placeholder="0" required>
                </td>
                <td>
                    <button type="button" class="btn btn-danger btn-sm remove-row">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `);

        rowIndex = 1;
        updateDate();
        getLastQuotationNumber();
        $("#companyName").val("");
        $("#clientName").val("");
        $("#clientNUIT").val("");
        $("#client-select").val("");

    } catch (error) {
        console.error('Error:', error);
        Swal.fire({
            icon: 'error',
            title: 'Erro!',
            text: error.message || 'Erro ao criar cotação.',
            showConfirmButton: true,
            confirmButtonText: 'Fechar'
        });
    } finally {
        submitBtn.prop('disabled', false).html(originalHtml);
         form.reset();
    }
});

const updateNumeration = () => {
    getLastQuotationNumber();
};

const getLastQuotationNumber = async () => {
    try {
        const response = await fetch('/api/quotations/next-number');
        const data = await response.json();
        if (data.success) {
            document.getElementById('quotationNumber').value = data.number;
        }
    } catch (e) {
        console.error('Erro ao obter número da cotação:', e);
    }
};

async function getProducts() {
    fetch('/api/products')
        .then(response => response.json())
        .then(data => {
            if (data.status === "success" && data.products.length > 0) {
                const products = data.products;
                const productSelect = document.createElement('select');
                productSelect.className = 'form-control form-control-sm';
                productSelect.innerHTML =
                    `<option value="0">Selecionar</option>` +
                    products.map(product => `<option value="${product.unitPrice}">${product.description}</option>`).join('');

                $('#productSelectModal .modal-body').empty().html(productSelect);
            }
        });
}

async function getClients() {
    fetch('/api/clients')
        .then(response => response.json())
        .then(data => {
            if (data.status === "success" && data.clients.length > 0) {
                const clients = data.clients;
                let clientsOptions = clients
                    .map(client => `<option value="${client.nuit}">${client.name}</option>`)
                    .join('');

                $('#client-select').append(clientsOptions);
            }
        });
}

async function updateDate() {
    const inputDate = document.querySelector('input[name="date"]');
    const today = new Date().toISOString().split('T')[0];
    inputDate.value = today;
}

$('#productSelectModal').on('change', 'select', function () {
    if ($(this).val() == 0) {
        $('#productSelectModal').modal('hide');
        return;
    }

    const selectedOption = $(this).find('option:selected');
    const unitPrice = selectedOption.val();
    const description = selectedOption.text();
    const quantity = 1;

    selectedRow.find('input.description').val(description);
    selectedRow.find('input.unitPrice').val(unitPrice);
    selectedRow.find('input.quantity').val(quantity);
    $('#productSelectModal').modal('hide');
});

$("#client-select").on("change", function () {
    const selectedOption = $(this).find('option:selected');
    const companyName = selectedOption.text();
    const companyNUIT = selectedOption.val();

    $("#companyName").val(companyName);
    $("#clientName").val(companyName);
    $("#clientNUIT").val(companyNUIT);
});

$('.table').on('click', '.btn-open-products-list', function () {
    const row = $(this).closest('tr');
    selectedRow = row;
});

async function downloadFile(url, filename = 'cotacao.pdf') {
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
    getLastQuotationNumber();
    getProducts();
    getClients();
    updateDate();
});