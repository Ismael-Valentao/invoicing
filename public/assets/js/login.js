function showError(message, canResend = false) {
    const errorBox = document.getElementById('errorBox');

    errorBox.innerHTML = `
        <div>${message}</div>
        ${canResend ? `
            <div class="mt-2">
                <button type="button" id="btnResendVerification" class="btn btn-primary btn-sm">
                    Reenviar e-mail de verificação
                </button>
            </div>
        ` : ''}
    `;

    errorBox.classList.remove('d-none');

    if (canResend) {
        const resendBtn = document.getElementById('btnResendVerification');
        if (resendBtn) {
            resendBtn.addEventListener('click', resendVerificationEmail);
        }
    }
}

function showSuccess(message) {
    const errorBox = document.getElementById('errorBox');
    errorBox.innerHTML = message;
    errorBox.classList.remove('d-none');
    errorBox.classList.remove('alert-danger');
    errorBox.classList.add('alert-success');
}

function resetMessageBox() {
    const errorBox = document.getElementById('errorBox');
    errorBox.classList.add('d-none');
    errorBox.classList.remove('alert-success');
    errorBox.classList.add('alert-danger');
    errorBox.innerHTML = '';
}

function hideError() {
    resetMessageBox();
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function resendVerificationEmail() {
    const email = document.getElementById('email').value.trim();
    const resendBtn = document.getElementById('btnResendVerification');

    if (!email) {
        showError('Digite o e-mail para reenviar a verificação.');
        return;
    }

    if (!isValidEmail(email)) {
        showError('Formato de e-mail inválido.');
        return;
    }

    if (resendBtn) {
        resendBtn.disabled = true;
        resendBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>A reenviar...';
    }

    try {
        const response = await fetch('/api/users/resend-verification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });

        if (response.status === 204) {
            showSuccess('Se a conta existir e ainda não estiver verificada, o e-mail foi reenviado.');
            return;
        }

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Não foi possível reenviar o e-mail de verificação.');
        }

        showSuccess(data.message || 'E-mail de verificação reenviado com sucesso. Verifique a sua caixa de entrada.');
    } catch (err) {
        showError(err.message || 'Erro ao reenviar o e-mail de verificação.');
    } finally {
        if (resendBtn) {
            resendBtn.disabled = false;
            resendBtn.innerHTML = 'Reenviar e-mail de verificação';
        }
    }
}

async function login() {
    hideError();

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value.trim();
    const loginBtn = document.getElementById('btnLogin');

    if (!email || !password) {
        showError('Preencha o email e a palavra-passe');
        return;
    }

    if (!isValidEmail(email)) {
        showError('Formato de e-mail inválido');
        return;
    }

    const originalHtml = loginBtn.innerHTML;
    loginBtn.disabled = true;
    loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>A entrar...';

    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.status === 403 && data.resendVerificationEmail) {
            showError(
                data.message || 'E-mail não verificado. Verifique a sua caixa de entrada.',
                true
            );
            return;
        }

        if (response.ok && data.success) {
            window.location.href = data.redirect || '/dashboard';
        } else {
            showError(data.message || 'Credenciais inválidas');
        }

    } catch (err) {
        showError('Erro de ligação ao servidor');
    } finally {
        loginBtn.disabled = false;
        loginBtn.innerHTML = originalHtml;
    }
}

document.getElementById('btnLogin').addEventListener('click', e => {
    e.preventDefault();
    login();
});