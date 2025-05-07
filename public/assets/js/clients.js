fetch('/api/clients')
    .then(response => response.json())
    .then(data => {
        data.clients.forEach(client => {
            const actualArray = [client.name, client.email, client.phone, client.nuit, `<button type="button" class="btn btn-secondary btn-sm mx-2 btn-edit-client" id="${client._id}"><i class="fa-solid fa-pen-to-square"></i></button><button type="button" class="btn btn-danger btn-sm mx-2 btn-delete-client" id="${client._id}"><i class="fa-solid fa-trash"></i></button>`];
            $('#dataTable').DataTable().row.add(actualArray).draw(false);
        });
    })
    .catch(error => console.error('Error fetching clients:', error));

$('#dataTable').on('click', '.btn-edit-client', function () {
    selectedRow = $(this).closest('tr');
    const clientId = $(this).attr('id');
    const clientName = selectedRow.find('td:eq(0)').text();
    const clientEmail = selectedRow.find('td:eq(1)').text();
    const clientPhone = selectedRow.find('td:eq(2)').text();
    const clientNuit = selectedRow.find('td:eq(3)').text();

    document.getElementById('clientId').value = clientId;
    document.getElementById('clientName').value = clientName;
    document.getElementById('clientEmail').value = clientEmail;
    document.getElementById('clientPhone').value = clientPhone;
    document.getElementById('clientNuit').value = clientNuit;

    $('#clientModal').modal('show');
})

document.getElementById('btn-update-client').addEventListener('click', function (e) {
    e.preventDefault();
    const clientId = document.getElementById('clientId').value;
    const data = $("#client-form").serialize();

    fetch(`/api/clients/${clientId}`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: data
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                $('#clientModal').modal('hide');
                selectedRow.find('td:eq(0)').text(data.client.name);
                selectedRow.find('td:eq(1)').text(data.client.email);
                selectedRow.find('td:eq(2)').text(data.client.phone);
                selectedRow.find('td:eq(3)').text(data.client.nuit);
            } else {
                alert('Erro ao actualizar cliente: ' + data.message);
                $('#clientModal').modal('hide');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Erro ao actualizar cliente. Tente novamente.');
            $('#clientModal').modal('hide');
        });
})

$('#dataTable').on('click', '.btn-delete-client', function () {
    const clientId = $(this).attr('id');
    const row = $(this).closest('tr');
    const clientName = row.find('td:eq(0)').text();

    if (confirm(`Tem certeza que deseja excluir o cliente ${clientName}?`)) {
        fetch(`/api/clients/${clientId}`, {
            method: 'DELETE'
        })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    $('#dataTable').DataTable().row(row).remove().draw(false);
                } else {
                    alert('Erro ao excluir cliente: ' + data.message);
                }
            })
            .catch(error => {
                console.error('Error:', error);
                alert('Erro ao excluir cliente. Tente novamente.');
            });
    }
})

document.getElementById('btn-open-client-modal').addEventListener('click', function () {
    document.getElementById('create-client-form').reset();
    document.getElementById('clientId').value = '';
    $('#createClientModal').modal('show');
})

document.getElementById('btn-create-client').addEventListener('click', function (e) {
    e.preventDefault();
    const data = $("#client-form").serialize();

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
                $('#clientModal').modal('hide');
                const actualArray = [data.client.name, data.client.email, data.client.phone, data.client.nuit, `<button type="button" class="btn btn-secondary btn-sm mx-2 btn-edit-client" id="${data.client._id}"><i class="fa-solid fa-pen-to-square"></i></button><button type="button" class="btn btn-danger btn-sm mx-2 btn-delete-client" id="${data.client._id}"><i class="fa-solid fa-trash"></i></button>`];
                $('#dataTable').DataTable().row.add(actualArray).draw(false);
            } else {
                alert('Erro ao criar cliente: ' + data.message);
                $('#clientModal').modal('hide');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Erro ao criar cliente. Tente novamente.');
            $('#clientModal').modal('hide');
        });
})