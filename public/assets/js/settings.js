const input_logo = document.getElementById('input-logo');
const logo_preview = document.getElementById('logo_preview');

document.getElementById('btn-add-logo').addEventListener('click', function(e){
    input_logo.click();
})

input_logo.addEventListener('change', function(e){
    if(!this.files[0]){
        return
    }
    const imageUrl = URL.createObjectURL(input_logo.files[0])
    logo_preview.src = imageUrl;

    $('#previewModal').modal('show');
})

document.getElementById('btn-save').addEventListener('click', function(e){
    const formData = new FormData();
    formData.append('logo', input_logo.files[0]);
    fetch('/api/company/logo', {
        method: 'POST',       
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            Swal.fire({
                icon: 'success',
                title: 'Sucesso!',
                text: 'Logo actualizada com sucesso.',
                showConfirmButton: true,
                confirmButtonText: 'OK'
            })
            $('#previewModal').modal('hide');
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
            text: 'Erro ao actualizar a logo. Tente novamente mais tarde.',
            showConfirmButton: true,
            confirmButtonText: 'OK'
        })
    });
})