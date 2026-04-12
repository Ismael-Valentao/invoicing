/**
 * Helpers de UI reutilizáveis — incluir em qualquer página que precise.
 */

// ═════════════════════════════════════════════════════════════════════════════
// LOADING STATE — usar em botões que fazem fetch
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Desactiva o botão e mostra spinner.
 * @param {HTMLElement} btn
 * @param {string} [text] texto enquanto carrega
 * @returns {string} HTML original para restaurar depois
 */
function btnLoading(btn, text) {
  if (!btn) return '';
  const original = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>' + (text || 'A processar...');
  return original;
}

/**
 * Restaura o botão ao estado original.
 * @param {HTMLElement} btn
 * @param {string} originalHtml
 */
function btnReset(btn, originalHtml) {
  if (!btn) return;
  btn.disabled = false;
  btn.innerHTML = originalHtml;
}

// ═════════════════════════════════════════════════════════════════════════════
// DATAS — formatar para DD/MM/YYYY (padrão PT)
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Formata uma data (string ISO ou Date) para DD/MM/YYYY.
 * @param {string|Date} d
 * @returns {string}
 */
function formatDatePT(d) {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/**
 * Formata para DD/MM/YYYY HH:MM.
 */
function formatDateTimePT(d) {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '—';
  return dt.toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ═════════════════════════════════════════════════════════════════════════════
// MOEDA — formatar para "1.234,56 MZN"
// ═════════════════════════════════════════════════════════════════════════════

function formatMZN(v) {
  return new Intl.NumberFormat('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0) + ' MZN';
}

// ═════════════════════════════════════════════════════════════════════════════
// VALIDAÇÃO VISUAL — mostrar/esconder erros em inputs Bootstrap
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Marca um input como inválido com mensagem.
 * @param {HTMLElement} input
 * @param {string} msg
 */
function showInputError(input, msg) {
  if (!input) return;
  input.classList.add('is-invalid');
  let fb = input.parentElement.querySelector('.invalid-feedback');
  if (!fb) {
    fb = document.createElement('div');
    fb.className = 'invalid-feedback';
    input.parentElement.appendChild(fb);
  }
  fb.textContent = msg;
}

/**
 * Remove erro de um input.
 */
function clearInputError(input) {
  if (!input) return;
  input.classList.remove('is-invalid');
  const fb = input.parentElement.querySelector('.invalid-feedback');
  if (fb) fb.textContent = '';
}

/**
 * Remove todos os erros de um formulário.
 */
function clearFormErrors(form) {
  if (!form) return;
  form.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));
  form.querySelectorAll('.invalid-feedback').forEach(el => el.textContent = '');
}
