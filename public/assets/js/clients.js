let selectedRow = null;
let selectedMobileCard = null;
let clientsTable = null;

function showToast(message, type = 'success') {
    if (typeof Toastify === 'undefined') {
        alert(message);
        return;
    }

    Toastify({
        text: message,
        duration: 3000,
        gravity: "top",
        position: "right",
        close: true,
        stopOnFocus: true,
        style: {
            background: type === 'success'
                ? "linear-gradient(to right, #00b09b, #96c93d)"
                : "linear-gradient(to right, #ff5f6d, #ffc371)"
        }
    }).showToast();
}

function safeValue(value, fallback = '') {
    if (value === undefined || value === null) return fallback;
    if (typeof value === 'string' && value.trim() === '') return fallback;
    return value;
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function buildActionButtons(client) {
    const address = escapeHtml(safeValue(client.address, 'N/A'));

    return `
        <button
            type="button"
            class="btn btn-secondary btn-sm mx-1 btn-edit-client"
            data-id="${client._id}"
            data-address="${address}">
            <i class="fa-solid fa-pen-to-square"></i>
        </button>
        <button
            type="button"
            class="btn btn-danger btn-sm mx-1 btn-delete-client"
            data-id="${client._id}">
            <i class="fa-solid fa-trash"></i>
        </button>
    `;
}

function buildMobileCard(client) {
    return `
        <div class="mobile-client-card" data-client-id="${client._id}">
            <div class="client-name">${escapeHtml(safeValue(client.name, 'N/A'))}</div>

            <div class="mobile-client-meta">
                <div><strong>E-mail:</strong> ${escapeHtml(safeValue(client.email, 'Sem e-mail'))}</div>
                <div><strong>Contacto:</strong> ${escapeHtml(safeValue(client.phone, 'N/A'))}</div>
                <div><strong>NUIT:</strong> ${escapeHtml(safeValue(client.nuit, 'N/A'))}</div>
                <div><strong>Endereço:</strong> ${escapeHtml(safeValue(client.address, 'N/A'))}</div>
            </div>

            <div class="mobile-client-actions">
                <button
                    type="button"
                    class="btn btn-secondary btn-sm btn-edit-client"
                    data-id="${client._id}"
                    data-address="${escapeHtml(safeValue(client.address, 'N/A'))}">
                    <i class="fa-solid fa-pen-to-square"></i> Editar
                </button>

                <button
                    type="button"
                    class="btn btn-danger btn-sm btn-delete-client"
                    data-id="${client._id}">
                    <i class="fa-solid fa-trash"></i> Excluir
                </button>
            </div>
        </div>
    `;
}

function addClientRow(client) {
    const rowData = [
        safeValue(client.name, 'N/A'),
        safeValue(client.email, ''),
        safeValue(client.phone, 'N/A'),
        safeValue(client.nuit, 'N/A'),
        buildActionButtons(client)
    ];

    clientsTable.row.add(rowData).draw(false);
}

function addMobileCard(client) {
    $('#mobileClientsList').append(buildMobileCard(client));
}

function updateMobileCard(client) {
    const card = $(`.mobile-client-card[data-client-id="${client._id}"]`);

    if (!card.length) return;

    const newCard = $(buildMobileCard(client));
    card.replaceWith(newCard);
}

function removeMobileCard(clientId) {
    $(`.mobile-client-card[data-client-id="${clientId}"]`).remove();
}

function loadClients(clients) {
    clients.forEach(client => {
        addClientRow(client);
        addMobileCard(client);
    });
}

$(document).ready(function () {
    clientsTable = $('#dataTable').DataTable({
        language: {
            url: "//cdn.datatables.net/plug-ins/1.13.8/i18n/pt-PT.json"
        }
    });

    fetch('/api/clients')
        .then(response => response.json())
        .then(data => {
            if (!data.clients || !Array.isArray(data.clients)) return;
            loadClients(data.clients);
        })
        .catch(error => {
            console.error('Error fetching clients:', error);
            showToast('Erro ao carregar clientes', 'error');
        });
});

$(document).on('click', '.btn-edit-client', function () {
    const clientId = $(this).data('id');
    const clientAddress = $(this).data('address') || '';

    const row = $(this).closest('tr');
    const card = $(this).closest('.mobile-client-card');

    selectedRow = row.length ? row : null;
    selectedMobileCard = card.length ? card : null;

    let clientName = '';
    let clientEmail = '';
    let clientPhone = '';
    let clientNuit = '';

    if (selectedRow) {
        clientName = selectedRow.find('td:eq(0)').text().trim();
        clientEmail = selectedRow.find('td:eq(1)').text().trim();
        clientPhone = selectedRow.find('td:eq(2)').text().trim();
        clientNuit = selectedRow.find('td:eq(3)').text().trim();
    } else if (selectedMobileCard) {
        clientName = selectedMobileCard.find('.client-name').text().trim();
        clientEmail = selectedMobileCard.find('.mobile-client-meta div:eq(0)').text().replace('E-mail:', '').trim();
        clientPhone = selectedMobileCard.find('.mobile-client-meta div:eq(1)').text().replace('Contacto:', '').trim();
        clientNuit = selectedMobileCard.find('.mobile-client-meta div:eq(2)').text().replace('NUIT:', '').trim();

        if (clientEmail === 'Sem e-mail') clientEmail = '';
    }

    document.getElementById('btn-update-client').setAttribute('data-client-id', clientId);
    document.getElementById('client-name-update').value = clientName;
    document.getElementById('client-email-update').value = clientEmail;
    document.getElementById('client-phone-update').value = clientPhone;
    document.getElementById('client-nuit-update').value = clientNuit;
    document.getElementById('client-address-update').value = clientAddress;

    $('#updateClientModal').modal('show');
});

document.getElementById('btn-update-client').addEventListener('click', function (e) {
    e.preventDefault();

    const clientId = this.getAttribute('data-client-id');
    const data = $("#update-client-form").serialize();

    fetch(`/api/clients/${clientId}`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: data
    })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                if (selectedRow) {
                    selectedRow.find('td:eq(0)').text(safeValue(data.client.name, 'N/A'));
                    selectedRow.find('td:eq(1)').text(safeValue(data.client.email, ''));
                    selectedRow.find('td:eq(2)').text(safeValue(data.client.phone, 'N/A'));
                    selectedRow.find('td:eq(3)').text(safeValue(data.client.nuit, 'N/A'));
                    selectedRow.find('.btn-edit-client').attr('data-address', safeValue(data.client.address, 'N/A'));
                }

                updateMobileCard(data.client);

                $('#updateClientModal').modal('hide');
                showToast('Cliente actualizado com sucesso');
            } else {
                showToast(data.error || 'Erro ao actualizar cliente', 'error');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showToast('Erro ao actualizar cliente. Tente novamente.', 'error');
        });
});

$(document).on('click', '.btn-delete-client', function () {
    const clientId = $(this).data('id');
    const row = $(this).closest('tr');
    const card = $(this).closest('.mobile-client-card');

    const clientName = row.length
        ? row.find('td:eq(0)').text()
        : card.find('.client-name').text();

    if (confirm(`Tem certeza que deseja excluir o cliente ${clientName}?`)) {
        fetch(`/api/clients/${clientId}`, {
            method: 'DELETE'
        })
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    if (row.length) {
                        clientsTable.row(row).remove().draw(false);
                    } else {
                        const desktopRow = $(`#dataTable .btn-delete-client[data-id="${clientId}"]`).closest('tr');
                        if (desktopRow.length) {
                            clientsTable.row(desktopRow).remove().draw(false);
                        }
                    }

                    removeMobileCard(clientId);
                    showToast('Cliente excluído com sucesso');
                } else {
                    showToast(data.error || 'Erro ao excluir cliente', 'error');
                }
            })
            .catch(error => {
                console.error('Error:', error);
                showToast('Erro ao excluir cliente. Tente novamente.', 'error');
            });
    }
});

document.getElementById('btn-open-client-modal').addEventListener('click', function () {
    document.getElementById('create-client-form').reset();
    $('#createClientModal').modal('show');
});

document.getElementById('btn-create-client').addEventListener('click', function (e) {
    e.preventDefault();

    const data = $("#create-client-form").serialize();

    fetch('/api/clients', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: data
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                addClientRow(data.client);
                addMobileCard(data.client);

                showToast('Cliente criado com sucesso');

                document.getElementById('create-client-form').reset();
                document.getElementById('client-name').focus();
            } else {
                showToast(data.error || 'Erro ao criar cliente', 'error');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showToast('Erro ao criar cliente. Tente novamente.', 'error');
        });
});