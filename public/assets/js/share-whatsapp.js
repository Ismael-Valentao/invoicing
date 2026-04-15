/**
 * Handler global para botões "Partilhar por WhatsApp".
 *
 * Uso: adicionar a um botão/link os atributos
 *   class="btn-share-whatsapp"
 *   data-doc-type="invoice|quotation|recibo|vd"
 *   data-doc-id="<mongo id>"
 *
 * Ao clicar, busca o link + mensagem em /api/share/:type/:id e abre wa.me.
 */
(function () {
    function handle(btn) {
        const type = btn.dataset.docType;
        const id = btn.dataset.docId;
        if (!type || !id) return;

        const original = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        btn.style.pointerEvents = 'none';

        fetch('/api/share/' + encodeURIComponent(type) + '/' + encodeURIComponent(id))
            .then(function (r) { return r.json(); })
            .then(function (d) {
                if (!d.success) {
                    if (window.Swal) Swal.fire({ icon: 'error', title: 'Erro', text: d.message || 'Erro ao preparar partilha.' });
                    else alert(d.message || 'Erro ao preparar partilha.');
                    return;
                }

                if (!d.clientPhone) {
                    if (window.Swal) {
                        Swal.fire({
                            title: 'Telefone do cliente',
                            input: 'tel',
                            inputLabel: 'Cliente sem telefone registado',
                            inputPlaceholder: '84xxxxxxx',
                            showCancelButton: true,
                            confirmButtonText: 'Abrir WhatsApp',
                            cancelButtonText: 'Sem número',
                            inputValidator: function () { return null; }
                        }).then(function (r) {
                            const digits = (r.value || '').replace(/\D/g, '');
                            const base = 'https://wa.me/';
                            const phone = digits
                                ? (digits.startsWith('258') ? digits : (digits.length === 9 ? '258' + digits : digits))
                                : '';
                            const url = base + phone + '?text=' + encodeURIComponent(d.message);
                            window.open(url, '_blank', 'noopener');
                        });
                    } else {
                        window.open(d.whatsappUrl, '_blank', 'noopener');
                    }
                    return;
                }

                window.open(d.whatsappUrl, '_blank', 'noopener');
            })
            .catch(function () {
                if (window.Swal) Swal.fire({ icon: 'error', title: 'Erro', text: 'Falha de ligação.' });
                else alert('Falha de ligação.');
            })
            .finally(function () {
                btn.innerHTML = original;
                btn.style.pointerEvents = '';
            });
    }

    document.addEventListener('click', function (e) {
        const btn = e.target.closest('.btn-share-whatsapp');
        if (!btn) return;
        e.preventDefault();
        handle(btn);
    });
})();
