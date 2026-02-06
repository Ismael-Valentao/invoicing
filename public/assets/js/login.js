function showError(message) {
    const errorBox = document.getElementById('errorBox');
    errorBox.textContent = message;
    errorBox.classList.remove('d-none');
}

function hideError() {
    document.getElementById('errorBox').classList.add('d-none');
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function login() {
    hideError();

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value.trim();

    if (!email || !password) {
        showError('Preencha o email e a palavra-passe');
        return;
    }

    if (!isValidEmail(email)) {
        showError('Formato de e-mail inválido');
        return;
    }

    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.status === 403) {
           showError(data.message || 'E-mail não verificado! Verifique a sua caixa de e-mail');
            return;
        }


        if (response.ok && data.success) {
            window.location.href = '/dashboard';
        } else {
            showError(data.message || 'Credenciais inválidas');
        }

    } catch (err) {
        showError('Erro de ligação ao servidor');
    }
}

document.querySelector('.btn-user').addEventListener('click', e => {
    e.preventDefault();
    login();
});
