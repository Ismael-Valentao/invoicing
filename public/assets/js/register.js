document.addEventListener("DOMContentLoaded", function () {
    const $ = (id) => document.getElementById(id);

    function showError(title, text) {
        Swal.fire({ icon: 'error', title, text });
    }

    function showSuccess(title, text) {
        Swal.fire({ icon: 'success', title, text });
    }

    function borderError(id) {
        const el = $(id);
        if (el) el.style.borderColor = '#dc3545';
    }

    function borderSuccess(id) {
        const el = $(id);
        if (el) el.style.borderColor = '#28a745';
    }

    function borderReset(id) {
        const el = $(id);
        if (el) el.style.borderColor = '';
    }

    function validateCompanyName(name) {
        if (!name || name.length < 3) return false;
        if (!/[A-Za-zÀ-ÿ]/.test(name)) return false;
        return true;
    }

    function validateNUIT(nuit) {
        return /^\d{9}$/.test(nuit);
    }

    function validateMozPhone(phone) {
        const clean = phone.replace(/\s+/g, '');
        return /^(?:\+258)?(82|83|84|85|86|87)\d{7}$/.test(clean);
    }

    function validatePasswordRules(password) {
        return (
            password.length >= 8 &&
            /[A-Z]/.test(password) &&
            /[a-z]/.test(password) &&
            /[0-9]/.test(password)
        );
    }

    const COMMON_DOMAINS = ['gmail.com', 'outlook.com', 'hotmail.com', 'yahoo.com'];
    const BLOCKED_DOMAINS = ['test', 'teste', 'fake', 'example', 'email'];

    function validateRealEmail(email) {
        const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9-]{2,}\.[a-zA-Z]{2,}$/;
        if (!regex.test(email)) return false;

        const domain = email.split('@')[1].toLowerCase();
        if (BLOCKED_DOMAINS.some(d => domain.startsWith(d))) return false;

        return true;
    }


    function suggestEmailDomain(email) {
        const [local, domain] = email.split('@');
        if (!domain) return null;

        let best = null;
        let min = Infinity;

        COMMON_DOMAINS.forEach(d => {
            const dist = levenshtein(domain, d);
            if (dist < min && dist <= 3) {
                min = dist;
                best = `${local}@${d}`;
            }
        });

        return best;
    }


    function validateCompanyStep() {
        let valid = true;

        const fields = {
            companyName: validateCompanyName,
            companyEmail: validateRealEmail,
            companyPhone: validateMozPhone,
            companyNuit: validateNUIT,
        };

        if (!validateNUIT(document.getElementById("companyNuit").value)) {
            Swal.fire('Erro', 'O NUIT deve ter 9 dígitos.', 'error');
            borderError("companyNuit");
            return
        }

        for (const id in fields) {
            const input = document.getElementById(id);

            if (!input) {
                console.warn(`Campo não encontrado: ${id}`);
                valid = false;
                continue;
            }

            const value = input.value.trim();

            if (!value || !fields[id](value)) {
                borderError(id);
                valid = false;
            } else {
                borderSuccess(id);
            }
        }

        if (!valid) {
            Swal.fire('Erro', 'Verifique os dados da empresa.', 'error');
        }

        return valid;
    }


    function validateFinalForm() {
        if (!validateCompanyStep()) return false;

        const password = $('password').value;
        const repeat = $('repeatPassword').value;

        if (password !== repeat) {
            showError('Senha inválida', 'As senhas não coincidem.');
            return false;
        }

        if (!validatePasswordRules(password)) {
            showError(
                'Senha fraca',
                'Use 8+ caracteres, maiúscula, minúscula e número.'
            );
            return false;
        }

        return true;
    }

    document.getElementById('btn-save').addEventListener('click', async (e) => {
        e.preventDefault();
        if (!validateFinalForm()) return;

        try {
            const form = document.getElementById('register-form');
            const formData = new FormData(form);
            const params = new URLSearchParams(formData); // transforma em x-www-form-urlencoded

            const res = await fetch('/api/company', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: params.toString()
            });

            const data = await res.json();

            if (data.status === 'success') {
                launchConfetti();
                setTimeout(() => {
                    showSuccess('Sucesso!', 'Empresa criada com sucesso. Verifique o seu e-mail.');
                    setTimeout(() => {
                        window.location.href = '/login';
                    }, 5000)
                }, 3000);
            } else {
                showError('Erro', data.message);
            }
        } catch (error) {
            console.log(error);
            showError('Erro', 'Erro ao criar a empresa.');
        }
    });



    document.getElementById('btn-next').addEventListener('click', () => {
        if (!validateCompanyStep()) return;

        document.getElementById('info-description').innerText =
            'Informações do Usuário';

        document.getElementById('companyInfo').style.display = 'none';
        document.getElementById('userInfo').classList.remove('d-none');

        document.getElementById('next-footer').classList.add('d-none');
        document.getElementById('save-footer').classList.remove('d-none');
    });

    // Gera senha forte
    function generateStrongPassword(length = 14) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+[]{}<>?';
        let password = '';
        for (let i = 0; i < length; i++) {
            password += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return password;
    }

    // Checa força da senha
    function checkPasswordStrength(password) {
        let strength = 0;
        if (password.length >= 8) strength++;
        if (/[A-Z]/.test(password)) strength++;
        if (/[a-z]/.test(password)) strength++;
        if (/[0-9]/.test(password)) strength++;
        if (/[^A-Za-z0-9]/.test(password)) strength++;
        return strength;
    }

    // Atualiza label de força
    function updateStrengthLabel(strength) {
        const label = document.getElementById('passwordStrength');
        if (!label) return;

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

    // Input evento: força da senha
    document.getElementById('password')?.addEventListener('input', e => {
        const strength = checkPasswordStrength(e.target.value);
        updateStrengthLabel(strength);
    });

    // Botão gerar senha
    document.getElementById('generatePassword')?.addEventListener('click', () => {
        const password = generateStrongPassword();
        const pwdInput = document.getElementById('password');
        const repeatInput = document.getElementById('repeatPassword');

        if (pwdInput && repeatInput) {
            pwdInput.value = password;
            repeatInput.value = password;
            updateStrengthLabel(checkPasswordStrength(password));
        }
    });

    // Mostrar / ocultar senha
    document.getElementById('togglePassword')?.addEventListener('click', () => {
        const input = document.getElementById('password');
        const icon = document.querySelector('#togglePassword i');
        if (!input || !icon) return;

        if (input.type === 'password') {
            input.type = 'text';
            icon.classList.replace('fa-eye', 'fa-eye-slash');
        } else {
            input.type = 'password';
            icon.classList.replace('fa-eye-slash', 'fa-eye');
        }
    });

    // Copiar senha
    document.getElementById('copyPassword')?.addEventListener('click', async () => {
        const password = document.getElementById('password')?.value;
        if (!password) return;

        await navigator.clipboard.writeText(password);

        const btn = document.getElementById('copyPassword');
        btn.classList.add('text-success');
        setTimeout(() => btn.classList.remove('text-success'), 1000);
    });

})

document.getElementById('btn-prev').addEventListener('click', () => {
    // Mostra empresa, esconde usuário
    document.getElementById('companyInfo').classList.remove('d-none');
    document.getElementById('userInfo').classList.add('d-none');

    // Atualiza título / descrição
    document.getElementById('info-description').innerText = 'Informações da Empresa';

    // Alterna os botões
    document.getElementById('save-footer').classList.add('d-none');
    document.getElementById('next-footer').classList.remove('d-none');
});
