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
    const companyName = document.getElementById('companyName').value.trim();
    const companyEmail = document.getElementById('companyEmail').value.trim();
    const companyPhone = document.getElementById('companyPhone').value.trim();
    const firstName = document.getElementById('firstName').value.trim();
    const lastName = document.getElementById('lastName').value.trim();
    const userEmail = document.getElementById('userEmail').value.trim();
    const userPhone = document.getElementById('userPhone').value.trim();

    if (!companyName || !companyEmail || !companyPhone || !lastName || !firstName || !userEmail || !userPhone) {
        Swal.fire({
            icon: 'error',
            title: 'Erro!',
            text: 'Todos os campos são obrigatórios.'
        });
        return false;
    }

    if (!validateRealEmail(companyEmail) || !validateRealEmail(userEmail)) {
        Swal.fire({
            icon: 'error',
            title: 'Email inválido',
            text: 'Use um email real e válido.'
        });
        return false;
    }

    if (!validateMozPhone(companyPhone) || !validateMozPhone(userPhone)) {
        Swal.fire({
            icon: 'error',
            title: 'Contacto inválido',
            text: 'Use um número válido de Moçambique (ex: 84xxxxxxx ou +25884xxxxxxx).'
        });
        return false;
    }

    return true;
}

function validateMozPhone(phone) {
    const clean = phone.replace(/\s+/g, '');

    // +25884xxxxxxx ou 84xxxxxxx
    const mozRegex = /^(?:\+258)?(82|83|84|85|86|87)\d{7}$/;

    return mozRegex.test(clean);
}


function validateRealEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    const blockedPatterns = [
        /^teste/i,
        /^test/i,
        /^admin/i,
        /^example/i,
        /^fake/i
    ];

    if (!emailRegex.test(email)) return false;

    const localPart = email.split('@')[0];

    if (blockedPatterns.some(rx => rx.test(localPart))) {
        return false;
    }

    return true;
}


document.getElementById('btn-save').addEventListener('click', function (e) {
    e.preventDefault();
    if (!validateForm() || !validatePassword()) {
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
                launchConfetti()
                setTimeout(() => {
                    Swal.fire({
                        icon: 'success',
                        title: 'Sucesso!',
                        text: 'Empresa criada com sucesso. Veja o seu email para os detalhes de login.',
                        showConfirmButton: true,
                        confirmButtonText: 'Fechar'
                    });
                }, 2000)
                setTimeout(() => {
                    window.location.href = '/login';
                }, 8000);
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
