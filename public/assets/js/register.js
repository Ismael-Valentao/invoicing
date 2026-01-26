document.getElementById('btn-next').addEventListener('click', function () {
    document.getElementById('info-description').innerText = 'Informações do Usuário';

    document.getElementById('companyInfo').style.display = 'none';
    document.getElementById('userInfo').classList.remove('d-none');

    document.getElementById('save-footer').classList.remove('d-none');
    document.getElementById('next-footer').classList.add('d-none');
});

document.getElementById('btn-prev').addEventListener('click', function () {
    document.getElementById('info-description').innerText = 'Informações da Empresa';
    document.getElementById('companyInfo').style.display = 'block';
    document.getElementById('userInfo').classList.add('d-none');

    document.getElementById('save-footer').classList.add('d-none');
    document.getElementById('next-footer').classList.remove('d-none');
});

function validateForm() {
    const companyName = document.getElementById('companyName').value;
    const companyEmail = document.getElementById('companyEmail').value;
    const companyPhone = document.getElementById('companyPhone').value;
    const firstName = document.getElementById('firstName').value;
    const lastName = document.getElementById('lastName').value;
    const userEmail = document.getElementById('userEmail').value;
    const userPhone = document.getElementById('userPhone').value;

    if (!companyName || !companyEmail || !companyPhone || !lastName || !firstName || !userEmail || !userPhone) {
        Swal.fire({
            icon: 'error',
            title: 'Erro!',
            text: 'Todos os campos são obrigatórios.',
            showConfirmButton: true,
            confirmButtonText: 'Fechar'
        });
        return false;
    }
    return true;
}

function validateEmail() {
    const companyEmail = document.getElementById('companyEmail').value;
    const userEmail = document.getElementById('userEmail').value;
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(String(companyEmail).toLowerCase()) && re.test(String(userEmail).toLowerCase());
}


document.getElementById('btn-save').addEventListener('click', function (e) {
    e.preventDefault();
    if (!validateForm() || !validatePassword() || !validateEmail()) {
        return;
    }
    const form = $('#register-form').serialize();

    fetch('/api/company', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: form
    })
        .then(response => response.json())
        .then(data => {
            if (data.status === "success") {
                Swal.fire({
                    icon: 'success',
                    title: 'Sucesso!',
                    text: 'Empresa criada com sucesso.',
                    showConfirmButton: true,
                    confirmButtonText: 'Fechar'
                });
                setTimeout(() => {
                    window.location.href = '/login';
                }, 2000);
            } else {
                Swal.fire({
                    icon: 'error',
                    title: 'Erro!',
                    text: data.message,
                    showConfirmButton: true,
                    confirmButtonText: 'Fechar'
                });
            }
        }).catch(error => {
            Swal.fire({
                icon: 'error',
                title: 'Erro!',
                text: 'Erro ao criar o usuário. Tente novamente mais tarde.',
                showConfirmButton: true,
                confirmButtonText: 'Fechar'
            });
        });

})



function validatePassword() {
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('repeatPassword').value;

    if (password !== confirmPassword) {
        Swal.fire({
            icon: 'error',
            title: 'Erro!',
            text: 'As senhas não coincidem.',
            showConfirmButton: true,
            confirmButtonText: 'Fechar'
        });
        return false;
    }
    else if (password.length < 8) {
        Swal.fire({
            icon: 'error',
            title: 'Erro!',
            text: 'A senha deve ter pelo menos 8 caracteres.',
            showConfirmButton: true,
            confirmButtonText: 'Fechar'
        });
        return false;
    }
    else if (!/[A-Z]/.test(password)) {
        Swal.fire({
            icon: 'error',
            title: 'Erro!',
            text: 'A senha deve conter pelo menos uma letra maiúscula.',
            showConfirmButton: true,
            confirmButtonText: 'Fechar'
        });
        return false;
    }
    else if (!/[a-z]/.test(password)) {
        Swal.fire({
            icon: 'error',
            title: 'Erro!',
            text: 'A senha deve conter pelo menos uma letra minúscula.',
            showConfirmButton: true,
            confirmButtonText: 'Fechar'
        });
        return false;
    }
    else if (!/[0-9]/.test(password)) {
        Swal.fire({
            icon: 'error',
            title: 'Erro!',
            text: 'A senha deve conter pelo menos um número.',
            showConfirmButton: true,
            confirmButtonText: 'Fechar'
        });
        return false;
    }
    return true;
}

function generateStrongPassword(length = 14) {
    const chars =
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+[]{}<>?';
    let password = '';
    for (let i = 0; i < length; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
}

function checkPasswordStrength(password) {
    let strength = 0;

    if (password.length >= 8) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;

    return strength;
}

function updateStrengthLabel(strength) {
    const label = document.getElementById('passwordStrength');

    if (strength <= 2) {
        label.textContent = 'Fraca';
        label.className = 'form-text text-danger';
    } else if (strength === 3 || strength === 4) {
        label.textContent = 'Média';
        label.className = 'form-text text-warning';
    } else {
        label.textContent = 'Forte';
        label.className = 'form-text text-success';
    }
}

document.getElementById('generatePassword').addEventListener('click', () => {
    const password = generateStrongPassword();
    document.getElementById('password').value = password;
    document.getElementById('repeatPassword').value = password;

    const strength = checkPasswordStrength(password);
    updateStrengthLabel(strength);
});

document.getElementById('password').addEventListener('input', (e) => {
    const strength = checkPasswordStrength(e.target.value);
    updateStrengthLabel(strength);
});

/* Mostrar / ocultar */
document.getElementById('togglePassword').addEventListener('click', () => {
    const input = document.getElementById('password');
    const icon = document.querySelector('#togglePassword i');

    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.replace('fa-eye', 'fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.replace('fa-eye-slash', 'fa-eye');
    }
});

/* Copiar palavra-passe */
document.getElementById('copyPassword').addEventListener('click', async () => {
    const password = document.getElementById('password').value;

    if (!password) return;

    await navigator.clipboard.writeText(password);

    const btn = document.getElementById('copyPassword');
    btn.classList.add('text-success');

    setTimeout(() => btn.classList.remove('text-success'), 1000);
});
