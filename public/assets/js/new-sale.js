document.addEventListener("DOMContentLoaded", function () {
    const tableBody = document.querySelector("#saleItemsTable tbody");
    const addRowBtn = document.getElementById("addSaleRow");
    const totalDisplay = document.getElementById("saleTotal");
    const amountPaidInput = document.getElementById("amountPaid");
    const changeDisplay = document.getElementById("changeAmount");
    const form = document.getElementById("sale-form");
    const paymentMethodEl = document.getElementById("paymentMethod"); // opcional
    let activeSuggestionIndex = -1;

    let activeRow = null;

    // Cache produtos para autocomplete + modal
    let PRODUCTS_CACHE = [];
    let PRODUCTS_LOADED = false;

    /* =============================
     * Helpers
     * ============================= */
    function formatCurrency(value) {
        return new Intl.NumberFormat("pt-MZ", {
            style: "currency",
            currency: "MZN",
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })
            .format(Number(value || 0))
            .replace("MTn", "MZN");
    }

    function parseNumber(v) {
        const n = Number(v);
        return Number.isFinite(n) ? n : 0;
    }

    function escapeHtml(str) {
        return String(str).replace(/[&<>"']/g, (m) => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        }[m]));
    }

    function debounce(fn, delay = 250) {
        let t = null;
        return (...args) => {
            clearTimeout(t);
            t = setTimeout(() => fn(...args), delay);
        };
    }

    /* =============================
     * Produtos
     * ============================= */
    async function fetchProducts() {
        const res = await fetch("/api/products");
        const data = await res.json();

        if (data?.status === "success" && Array.isArray(data.products)) {
            return data.products;
        }
        return [];
    }

    async function ensureProductsLoaded() {
        if (PRODUCTS_LOADED) return;
        PRODUCTS_CACHE = await fetchProducts();
        PRODUCTS_LOADED = true;
    }

    /* =============================
     * Cálculos
     * ============================= */
    function updateRowSubtotal(row) {
        const qty = parseNumber(row.querySelector(".quantity")?.value);
        const price = parseNumber(row.querySelector(".unitPrice")?.value);
        const subtotal = qty * price;
        row.querySelector(".subtotal").value = subtotal.toFixed(2);
        updateTotal();
    }

    function updateTotal() {
        let total = 0;
        tableBody.querySelectorAll("tr").forEach((row) => {
            total += parseNumber(row.querySelector(".subtotal")?.value);
        });
        totalDisplay.textContent = formatCurrency(total);
        updateChange(total);
    }

    function updateChange(total) {
        const paid = parseNumber(amountPaidInput.value);
        const change = paid - total;
        changeDisplay.textContent = formatCurrency(change > 0 ? change : 0);
    }

    amountPaidInput?.addEventListener("input", () => updateTotal());

    /* =============================
     * Autocomplete UI
     * ============================= */
    function getSuggestionBox(row) {
        let box = row.querySelector(".suggestion-box");
        if (box) return box;

        const td = row.querySelector("td"); // 1ª coluna
        td.style.position = "relative";

        box = document.createElement("div");
        box.className = "suggestion-box";
        box.style.position = "absolute";
        box.style.left = "0";
        box.style.right = "0";
        box.style.top = "100%";
        box.style.zIndex = "9999";
        box.style.background = "#fff";
        box.style.border = "1px solid #e3e6f0";
        box.style.borderRadius = "0.35rem";
        box.style.boxShadow = "0 0.15rem 1.75rem 0 rgba(58,59,69,.15)";
        box.style.maxHeight = "240px";
        box.style.overflowY = "auto";
        box.style.marginTop = "4px";
        box.style.display = "none";

        td.appendChild(box);
        return box;
    }

    function hideSuggestions(row) {
        const box = row.querySelector(".suggestion-box");
        if (box) {
            box.style.display = "none";
            box.innerHTML = "";
        }
    }

    function renderSuggestions(row, query) {
        const box = getSuggestionBox(row);
        const q = (query || "").trim().toLowerCase();

        if (!q || q.length < 2) {
            hideSuggestions(row);
            return;
        }

        const matches = PRODUCTS_CACHE
            .filter((p) => (p.description || "").toLowerCase().includes(q))
            .slice(0, 8);

        if (!matches.length) {
            box.innerHTML = `<div style="padding:10px; font-size:12px; color:#858796;">Sem sugestões</div>`;
            box.style.display = "block";
            activeSuggestionIndex = -1;
            return;
        }

        box.innerHTML = matches.map((p) => {
            const stockQty = p.stock?.quantity ?? 0;
            return `
        <div class="suggestion-item"
             data-id="${p._id}"
             data-description="${escapeHtml(p.description)}"
             data-price="${p.unitPrice}"
             style="padding:10px; cursor:pointer; font-size:12px; border-bottom:1px solid #f1f1f1;">
          <div style="font-weight:700; color:#2e2f37;">${escapeHtml(p.description)}</div>
          <div style="display:flex; justify-content:space-between; color:#6c757d;">
            <span>${formatCurrency(p.unitPrice)}</span>
            <span>Stock: ${stockQty}</span>
          </div>
        </div>
      `;
        }).join("");

        box.style.display = "block";
        activeSuggestionIndex = -1;
    }

    function highlightSuggestion(box, index) {
        const items = box.querySelectorAll(".suggestion-item");

        items.forEach((item, i) => {
            item.style.background = i === index ? "#e3f2fd" : "#fff";
        });

        if (items[index]) {
            items[index].scrollIntoView({
                block: "nearest"
            });
        }
    }

    tableBody.addEventListener("keydown", function (e) {

        if (!e.target.classList.contains("description")) return;

        const row = e.target.closest("tr");
        const box = row.querySelector(".suggestion-box");
        if (!box || box.style.display === "none") return;

        const items = box.querySelectorAll(".suggestion-item");
        if (!items.length) return;

        if (e.key === "ArrowDown") {
            e.preventDefault();
            activeSuggestionIndex =
                activeSuggestionIndex < items.length - 1
                    ? activeSuggestionIndex + 1
                    : 0;

            highlightSuggestion(box, activeSuggestionIndex);
        }

        if (e.key === "ArrowUp") {
            e.preventDefault();
            activeSuggestionIndex =
                activeSuggestionIndex > 0
                    ? activeSuggestionIndex - 1
                    : items.length - 1;

            highlightSuggestion(box, activeSuggestionIndex);
        }

        if (e.key === "Enter") {
            e.preventDefault();

            if (activeSuggestionIndex >= 0) {
                items[activeSuggestionIndex].click();
            }
        }

        if (e.key === "Escape") {
            hideSuggestions(row);
        }
    });

    const debouncedSuggest = debounce(async (row, value) => {
        await ensureProductsLoaded();
        renderSuggestions(row, value);
    }, 250);

    // Quando digita na descrição -> sugestões
    tableBody.addEventListener("input", function (e) {
        if (!e.target.classList.contains("description")) return;
        const row = e.target.closest("tr");

        // se começar a digitar, invalida productId até escolher uma sugestão
        row.querySelector(".productId").value = "";

        debouncedSuggest(row, e.target.value);
    });

    // Clique numa sugestão -> aplica produto
    tableBody.addEventListener("click", function (e) {
        const item = e.target.closest(".suggestion-item");
        if (!item) return;

        const row = e.target.closest("tr");
        row.querySelector(".productId").value = item.getAttribute("data-id");
        row.querySelector(".description").value = item.getAttribute("data-description");
        row.querySelector(".unitPrice").value = parseNumber(item.getAttribute("data-price"));

        hideSuggestions(row);
        updateRowSubtotal(row);
    });

    // Fechar sugestões ao clicar fora
    document.addEventListener("click", function (e) {
        if (!e.target.closest(".suggestion-box") && !e.target.classList.contains("description")) {
            tableBody.querySelectorAll("tr").forEach((r) => hideSuggestions(r));
        }
    });

    /* =============================
     * Modal: lista de produtos (igual o teu)
     * ============================= */
    async function getProductsIntoModal() {
        await ensureProductsLoaded();

        if (!PRODUCTS_CACHE.length) {
            $("#productSelectModal .modal-body").html(`<p class="text-danger text-center">Nenhum produto ou serviço registado!!!</p>`);
            return;
        }

        // Select como no teu invoice, mas guardando id e preço
        const productSelect = document.createElement("select");
        productSelect.className = "form-control form-control-sm";
        productSelect.id = "productSelectDropdown";

        productSelect.innerHTML =
            `<option value="0">Selecionar</option>` +
            PRODUCTS_CACHE.map((p) =>
                `<option 
            value="${p.unitPrice}" 
            data-id="${p._id}" 
            data-description="${escapeHtml(p.description)}"
         >
          ${escapeHtml(p.description)}
         </option>`
            ).join("");

        $("#productSelectModal .modal-body").empty().html(productSelect);

        // Quando escolher no select -> aplica na linha ativa
        productSelect.addEventListener("change", function () {
            if (!activeRow) return;

            const selected = productSelect.options[productSelect.selectedIndex];
            const productId = selected.getAttribute("data-id");
            const description = selected.getAttribute("data-description");
            const price = parseNumber(productSelect.value);

            if (!productId || productSelect.value === "0") return;

            activeRow.querySelector(".productId").value = productId;
            activeRow.querySelector(".description").value = description;
            activeRow.querySelector(".unitPrice").value = price;

            hideSuggestions(activeRow);
            updateRowSubtotal(activeRow);

            $("#productSelectModal").modal("hide");
        });
    }

    // Abrir modal ao clicar em "Selecionar"
    tableBody.addEventListener("click", async function (e) {
        const btn = e.target.closest(".btn-open-products-list");
        if (!btn) return;

        activeRow = btn.closest("tr");
        await getProductsIntoModal();
        $("#productSelectModal").modal("show");
    });

    /* =============================
     * Linhas (add/remove) + eventos
     * ============================= */
    function buildRowHTML() {
        // description AGORA é editável para autocomplete
        return `
      <td class="d-flex">
        <input type="text" class="form-control form-control-sm description" placeholder="Digite para pesquisar..." required />
        <input type="hidden" class="productId" />
        <button type="button" class="btn btn-primary btn-sm ml-3 d-flex align-items-center btn-open-products-list">
          <i class="fa-solid fa-table-list mr-2"></i>
          <span>Selecionar</span>
        </button>
      </td>
      <td>
        <input type="number" value="1" min="1" class="form-control form-control-sm quantity" required />
      </td>
      <td>
        <input type="number" min="0" class="form-control form-control-sm unitPrice" required />
      </td>
      <td>
        <input type="text" class="form-control form-control-sm subtotal" readonly />
      </td>
      <td>
        <button type="button" class="btn btn-danger btn-sm remove-row">
          <i class="fas fa-trash"></i>
        </button>
      </td>
    `;
    }

    addRowBtn?.addEventListener("click", function () {
        const row = document.createElement("tr");
        row.innerHTML = buildRowHTML();
        tableBody.appendChild(row);
    });

    tableBody.addEventListener("click", function (e) {
        if (e.target.closest(".remove-row")) {
            if (tableBody.rows.length > 1) {
                e.target.closest("tr").remove();
                updateTotal();
            }
        }
    });

    tableBody.addEventListener("input", function (e) {
        if (e.target.classList.contains("quantity") || e.target.classList.contains("unitPrice")) {
            updateRowSubtotal(e.target.closest("tr"));
        }
    });

    /* =============================
     * Submit -> Backend espera productId/quantity/price
     * ============================= */
    form?.addEventListener("submit", async function (e) {
        e.preventDefault();

        const items = [];
        const rows = tableBody.querySelectorAll("tr");

        for (const row of rows) {
            const productId = row.querySelector(".productId")?.value;
            const quantity = parseNumber(row.querySelector(".quantity")?.value);
            const price = parseNumber(row.querySelector(".unitPrice")?.value);

            if (!productId) {
                alert("Selecione um produto válido (pela sugestão ou pela lista) em todas as linhas.");
                return;
            }

            if (quantity <= 0) {
                alert("Quantidade inválida.");
                return;
            }

            items.push({ productId, quantity, price });
        }

        const total = items.reduce((s, i) => s + (i.quantity * i.price), 0);

        const paidAmount = parseNumber(amountPaidInput.value || total);
        if (paidAmount < total) {
            alert("Valor pago insuficiente.");
            return;
        }

        const paymentMethod = paymentMethodEl?.value || "Cash";

        const payload = {
            items,
            paymentMethod,
            paidAmount
        };

        try {
            const response = await fetch("/api/sales", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                alert(err.message || "Erro ao criar venda.");
                return;
            }

            // backend devolve PDF
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            window.open(url, "_blank");

            window.location.reload();

        } catch (error) {
            console.error(error);
            alert("Erro ao processar venda.");
        }
    });

    // para criar a primeira linha

    // Inicializa subtotal/total da primeira linha
    setTimeout(() => {
        addRowBtn?.click();
        const firstRow = tableBody.querySelector("tr");
        if (firstRow) updateRowSubtotal(firstRow);
    }, 0);
});