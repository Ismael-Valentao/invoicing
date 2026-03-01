document.addEventListener("DOMContentLoaded", function () {
    const table = $("#dataTable").DataTable({
        pageLength: 10,
        lengthMenu: [10, 25, 50, 100],
        order: [[0, "asc"]],
    });

    const currency = (v) =>
        new Intl.NumberFormat("pt-MZ", {
            style: "currency",
            currency: "MZN",
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })
            .format(Number(v || 0))
            .replace("MTn", "MZN");

    const unitLabel = (u) => ({ un: "un", kg: "kg", lt: "lt", cx: "cx" }[u] || u || "un");

    function badgeStock(p) {
        const q = Number(p?.stock?.quantity || 0);
        const min = Number(p?.stock?.min || 0);
        if (q <= min && min > 0) return `<span class="badge badge-danger">Baixo</span>`;
        return `<span class="badge badge-success w-100">OK</span>`;
    }

    function clearAndFill(products) {
        table.clear();

        products.forEach((p) => {
            table.row.add([
                `<strong>${p.description}</strong>`, `<small class="text-muted">${p.sku ? "SKU: " + p.sku : ""}</small>`,
                `<span class="text-center d-block">${unitLabel(p.unit)}</span>`,
                `<span class="text-center d-block">${currency(p.unitPrice)}</span>`,
                `<span class="text-center d-block">${p.stock?.quantity ?? 0}</span>`,
                `<span class="text-center d-block">${p.stock?.min ?? 0}</span>`,
                `<span class="text-center d-block">${badgeStock(p)}</span>`,
                `
          <button class="btn btn-sm btn-outline-primary btn-edit" data-id="${p._id}">
            <i class="fa-solid fa-pen-to-square"></i>
          </button>
          <button class="btn btn-sm btn-outline-secondary btn-stock" data-id="${p._id}">
            <i class="fa-solid fa-boxes-stacked"></i>
          </button>
          <button class="btn btn-sm btn-outline-danger btn-deactivate" data-id="${p._id}">
            <i class="fa-solid fa-eye-slash"></i>
          </button>
        `,
            ]);
        });

        table.draw(false);
    }

    async function loadProducts() {
        const res = await fetch("/api/products"); // por padrão traz só ativos
        const data = await res.json();
        if (data.status === "success") clearAndFill(data.products || []);
    }

    // ====== CREATE ======
    document.getElementById("btn-add-product")?.addEventListener("click", async () => {
        const description = document.getElementById("add-product-name").value.trim();
        const unitPrice = document.getElementById("add-product-price").value;

        // extras (se adicionares inputs no modal)
        const sku = document.getElementById("add-product-sku")?.value?.trim() || "";
        const unit = document.getElementById("add-product-unit")?.value || "un";
        const stockQuantity = document.getElementById("add-product-stock")?.value || 0;
        const stockMin = document.getElementById("add-product-min")?.value || 0;

        if (!description || !unitPrice) {
            return Swal.fire({ icon: "warning", title: "Campos obrigatórios", text: "Preencha nome e preço." });
        }

        const payload = { description, unitPrice, sku, unit, stockQuantity, stockMin };

        const resp = await fetch("/api/products", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        const json = await resp.json().catch(() => ({}));
        if (!resp.ok) {
            return Swal.fire({ icon: "error", title: "Erro", text: json.message || "Erro ao criar produto" });
        }

        $("#productModal").modal("hide");
        Swal.fire({ icon: "success", title: "Sucesso", text: "Produto adicionado", timer: 1200, showConfirmButton: false });
        await loadProducts();
    });

    // ====== EDIT ======
    let editingId = null;

    $("#dataTable tbody").on("click", ".btn-edit", async function () {
        editingId = $(this).data("id");

        const res = await fetch(`/api/products/${editingId}`);
        const data = await res.json();

        if (data.status !== "success") {
            return Swal.fire({ icon: "error", title: "Erro", text: data.message || "Não foi possível carregar" });
        }

        const p = data.product;
        document.getElementById("update-product-name").value = p.description || "";
        document.getElementById("update-product-price").value = p.unitPrice ?? "";

        // se adicionares estes campos no modal update
        document.getElementById("update-product-sku") && (document.getElementById("update-product-sku").value = p.sku || "");
        document.getElementById("update-product-unit") && (document.getElementById("update-product-unit").value = p.unit || "un");
        document.getElementById("update-product-min") && (document.getElementById("update-product-min").value = p.stock?.min ?? 0);

        $("#updateProductModal").modal("show");
    });

    document.getElementById("btn-update-product")?.addEventListener("click", async () => {
        if (!editingId) return;

        const description = document.getElementById("update-product-name").value.trim();
        const unitPrice = document.getElementById("update-product-price").value;

        const sku = document.getElementById("update-product-sku")?.value?.trim() || "";
        const unit = document.getElementById("update-product-unit")?.value || "un";
        const stockMin = document.getElementById("update-product-min")?.value ?? undefined;

        if (!description || !unitPrice) {
            return Swal.fire({ icon: "warning", title: "Campos obrigatórios", text: "Preencha nome e preço." });
        }

        const active = document.getElementById("update-product-active")?.value;

        const payload = { description, unitPrice, sku, unit };
        if (stockMin !== undefined) payload.stockMin = stockMin;
        if (active !== undefined) payload.active = active === "true";

        const resp = await fetch(`/api/products/${editingId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        const json = await resp.json().catch(() => ({}));
        if (!resp.ok || json.status !== "success") {
            return Swal.fire({ icon: "error", title: "Erro", text: json.message || "Erro ao atualizar" });
        }

        $("#updateProductModal").modal("hide");
        Swal.fire({ icon: "success", title: "Sucesso", text: "Produto atualizado", timer: 1200, showConfirmButton: false });
        await loadProducts();
    });

    // ====== DEACTIVATE (soft delete) ======
    $("#dataTable tbody").on("click", ".btn-deactivate", function () {
        const id = $(this).data("id");

        Swal.fire({
            title: "Desativar produto?",
            text: "O produto será escondido do sistema (pode reativar depois).",
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Sim, desativar",
            cancelButtonText: "Cancelar",
        }).then(async (r) => {
            if (!r.isConfirmed) return;

            const resp = await fetch(`/api/products/${id}/deactivate`, { method: "PATCH" });
            const json = await resp.json().catch(() => ({}));

            if (!resp.ok || json.status !== "success") {
                return Swal.fire({ icon: "error", title: "Erro", text: json.message || "Erro ao desativar" });
            }

            Swal.fire({ icon: "success", title: "Feito", text: "Produto desativado", timer: 1200, showConfirmButton: false });
            await loadProducts();
        });
    });

    // ====== STOCK MOVEMENT (IN/OUT + reason) ======
    $("#dataTable tbody").on("click", ".btn-stock", async function () {
        const id = $(this).data("id");

        const res = await fetch(`/api/products/${id}`);
        const data = await res.json();

        if (data.status !== "success") {
            return Swal.fire({ icon: "error", title: "Erro", text: data.message || "Não foi possível carregar" });
        }

        const p = data.product;

        document.getElementById("stock-product-id").value = p._id;
        document.getElementById("stock-product-name").textContent = p.description;
        document.getElementById("stock-current").textContent = p.stock?.quantity ?? 0;

        document.getElementById("stock-type").value = "IN";
        document.getElementById("stock-qty").value = "";
        document.getElementById("stock-reason").value = "";
        document.getElementById("stock-note").value = "";

        $("#stockModal").modal("show");
    });

    document.getElementById("btn-save-stock")?.addEventListener("click", async () => {
        const productId = document.getElementById("stock-product-id").value;
        const type = document.getElementById("stock-type").value;
        const quantity = document.getElementById("stock-qty").value;
        const reason = document.getElementById("stock-reason").value.trim();
        const note = document.getElementById("stock-note").value.trim();

        if (!productId) return;

        if (!quantity || Number(quantity) <= 0) {
            return Swal.fire({ icon: "warning", title: "Quantidade inválida", text: "Informe uma quantidade válida." });
        }
        if (!reason) {
            return Swal.fire({ icon: "warning", title: "Motivo obrigatório", text: "Informe o motivo do movimento." });
        }

        const resp = await fetch(`/api/products/${productId}/stock`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type, quantity, reason, note }),
        });

        const json = await resp.json().catch(() => ({}));
        if (!resp.ok || json.status !== "success") {
            return Swal.fire({ icon: "error", title: "Erro", text: json.message || "Erro ao ajustar stock" });
        }

        $("#stockModal").modal("hide");
        Swal.fire({ icon: "success", title: "Sucesso", text: "Stock atualizado", timer: 1200, showConfirmButton: false });
        await loadProducts();
    });

    // init
    loadProducts().catch(console.error);
});