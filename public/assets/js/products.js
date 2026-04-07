document.addEventListener("DOMContentLoaded", function () {
  // ===== Desktop DataTable (só se existir no DOM) =====
  const hasDesktopTable = !!document.getElementById("dataTable");
  const isMobile = () => window.innerWidth < 768;

  let table = null;
  if (hasDesktopTable) {
    table = $("#dataTable").DataTable({
      pageLength: 10,
      lengthMenu: [10, 25, 50, 100],
      order: [[0, "asc"]],
    });
  }

  // ===== Mobile Cards + Load More =====
  const $mobileList = document.getElementById("productsMobileList");
  let mobilePageSize = 10;
  let mobileVisibleCount = 10;
  let lastProducts = [];

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

  function badgeStockText(p) {
    const q = Number(p?.stock?.quantity || 0);
    const min = Number(p?.stock?.min || 0);
    if (q <= min && min > 0) return { text: "Baixo", cls: "danger" };
    return { text: "OK", cls: "success" };
  }

  function resetMobilePagination() {
    mobileVisibleCount = mobilePageSize;
  }

  function renderMobile(products) {
    if (!$mobileList) return;

    if (!isMobile()) {
      $mobileList.innerHTML = "";
      return;
    }

    if (!products.length) {
      $mobileList.innerHTML = `<div class="text-center text-muted py-4">Sem produtos.</div>`;
      return;
    }

    const slice = products.slice(0, mobileVisibleCount);

    const cards = slice.map((p) => {
      const sku = p.sku ? p.sku : "—";
      const stock = p.stock?.quantity ?? 0;
      const min = p.stock?.min ?? 0;
      const st = badgeStockText(p);

      return `
        <div class="p-card">
          <div class="p-top">
            <div class="p-name">${p.description || "—"}</div>
            <div class="p-sku">${sku}</div>
          </div>

          <div class="p-meta">
            <span class="p-pill"><i class="fa-solid fa-scale-balanced"></i> Unid.: <strong>${unitLabel(p.unit)}</strong></span>
            <span class="p-pill"><i class="fa-solid fa-money-bill"></i> Preço: <strong>${currency(p.unitPrice)}</strong></span>
            <span class="p-pill"><i class="fa-solid fa-cubes"></i> Stock: <strong>${stock}</strong></span>
            <span class="p-pill"><i class="fa-solid fa-arrow-down-short-wide"></i> Mín.: <strong>${min}</strong></span>
            <span class="p-pill"><i class="fa-solid fa-circle-info"></i> Estado: <strong class="text-${st.cls}">${st.text}</strong></span>
          </div>

          <div class="p-actions">
            <button class="btn btn-outline-primary btn-edit" data-id="${p._id}">
              <i class="fa-solid fa-pen-to-square"></i> Editar
            </button>
            <button class="btn btn-outline-secondary btn-stock" data-id="${p._id}">
              <i class="fa-solid fa-boxes-stacked"></i> Stock
            </button>
            <button class="btn btn-outline-danger btn-deactivate" data-id="${p._id}">
              <i class="fa-solid fa-eye-slash"></i> Ocultar
            </button>
          </div>
        </div>
      `;
    }).join("");

    const showing = Math.min(mobileVisibleCount, products.length);
    const total = products.length;
    const hasMore = showing < total;

    const footer = `
      <div class="d-flex flex-column align-items-center py-2">
        <div class="text-muted mb-2" style="font-size:.85rem;">
          A mostrar <strong>${showing}</strong> de <strong>${total}</strong>
        </div>
        ${hasMore
        ? `<button class="btn btn-outline-primary btn-sm w-100" id="btnProductsMobileLoadMore">
                 <i class="fa-solid fa-plus"></i> Carregar mais
               </button>`
        : `<div class="text-muted" style="font-size:.85rem;">Fim da lista</div>`
      }
      </div>
    `;

    $mobileList.innerHTML = cards + footer;

    const btn = document.getElementById("btnProductsMobileLoadMore");
    if (btn) {
      btn.addEventListener("click", function () {
        mobileVisibleCount = Math.min(mobileVisibleCount + mobilePageSize, products.length);
        renderMobile(products);
      });
    }
  }

  function clearAndFill(products) {
    lastProducts = products;
    resetMobilePagination();
    renderMobile(products);

    // Desktop: DataTable
    if (!table) return;

    table.clear();

    products.forEach((p) => {
      const st = badgeStockText(p);
      const badge = st.text === "Baixo"
        ? `<span class="badge badge-danger">Baixo</span>`
        : `<span class="badge badge-success w-100">OK</span>`;

      table.row.add([
        `<strong>${p.description}</strong>`,
        `<small class="text-muted">${p.sku ? "SKU: " + p.sku : ""}</small>`,
        `<span class="text-center d-block">${unitLabel(p.unit)}</span>`,
        `<span class="text-center d-block">${currency(p.unitPrice)}</span>`,
        `<span class="text-center d-block">${p.stock?.quantity ?? 0}</span>`,
        `<span class="text-center d-block">${p.stock?.min ?? 0}</span>`,
        `<span class="text-center d-block">${badge}</span>`,
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
    const res = await fetch("/api/products");
    const data = await res.json();
    if (data.status === "success") clearAndFill(data.products || []);
  }

  // ====== CREATE ======
  document.getElementById("btn-add-product")?.addEventListener("click", async () => {
    const description = document.getElementById("add-product-name").value.trim();
    const unitPrice = document.getElementById("add-product-price").value;
    const costPrice = document.getElementById("add-product-cost")?.value || 0;
    const type = document.getElementById("add-product-type")?.value || "product";

    const sku = document.getElementById("add-product-sku")?.value?.trim() || "";
    const unit = document.getElementById("add-product-unit")?.value || "un";
    const stockQuantity = document.getElementById("add-product-stock")?.value || 0;
    const stockMin = document.getElementById("add-product-min")?.value || 0;

    if (!description || !unitPrice) {
      return Swal.fire({
        icon: "warning",
        title: "Campos obrigatórios",
        text: "Preencha nome e preço."
      });
    }

    const payload = { description, unitPrice, costPrice, sku, unit, stockQuantity, stockMin, type };

    const resp = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      return Swal.fire({
        icon: "error",
        title: "Erro",
        text: json.message || "Erro ao criar produto"
      });
    }

    resetAddProductForm();

    Swal.fire({
      icon: "success",
      title: "Sucesso",
      text: "Produto adicionado",
      timer: 1200,
      showConfirmButton: false
    });

    await loadProducts();
  });

  // ====== EDIT ======
  let editingId = null;

  // Delegation funciona para desktop e mobile
  document.addEventListener("click", async function (e) {
    const editBtn = e.target.closest(".btn-edit");
    if (editBtn) {
      editingId = editBtn.dataset.id;

      const res = await fetch(`/api/products/${editingId}`);
      const data = await res.json();

      if (data.status !== "success") {
        return Swal.fire({ icon: "error", title: "Erro", text: data.message || "Não foi possível carregar" });
      }

      const p = data.product;
      document.getElementById("update-product-name").value = p.description || "";
      document.getElementById("update-product-price").value = p.unitPrice ?? "";
      document.getElementById("update-product-cost") && (document.getElementById("update-product-cost").value = p.costPrice ?? "");
      const updType = document.getElementById("update-product-type");
      if (updType) {
        updType.value = p.type === 'service' ? 'service' : 'product';
        toggleUpdateStockFields(updType.value);
      }

      document.getElementById("update-product-sku") && (document.getElementById("update-product-sku").value = p.sku || "");
      document.getElementById("update-product-unit") && (document.getElementById("update-product-unit").value = p.unit || "un");
      document.getElementById("update-product-min") && (document.getElementById("update-product-min").value = p.stock?.min ?? 0);
      document.getElementById("update-product-active") && (document.getElementById("update-product-active").value = String(p.active ?? true));

      $("#updateProductModal").modal("show");
      return;
    }

    const deactBtn = e.target.closest(".btn-deactivate");
    if (deactBtn) {
      const id = deactBtn.dataset.id;

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
      return;
    }

    const stockBtn = e.target.closest(".btn-stock");
    if (stockBtn) {
      const id = stockBtn.dataset.id;

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
      const stockCostEl = document.getElementById("stock-cost");
      if (stockCostEl) stockCostEl.value = "";
      const stockCostWrap = document.getElementById("stock-cost-wrapper");
      if (stockCostWrap) stockCostWrap.style.display = ""; // visível por defeito (Entrada)
      document.getElementById("stock-reason").value = "";
      document.getElementById("stock-note").value = "";

      $("#stockModal").modal("show");
      return;
    }
  });

  document.getElementById("btn-update-product")?.addEventListener("click", async () => {
    if (!editingId) return;

    const description = document.getElementById("update-product-name").value.trim();
    const unitPrice = document.getElementById("update-product-price").value;
    const costPrice = document.getElementById("update-product-cost")?.value;

    const sku = document.getElementById("update-product-sku")?.value?.trim() || "";
    const unit = document.getElementById("update-product-unit")?.value || "un";
    const stockMin = document.getElementById("update-product-min")?.value ?? undefined;
    const active = document.getElementById("update-product-active")?.value;

    if (!description || !unitPrice) {
      return Swal.fire({ icon: "warning", title: "Campos obrigatórios", text: "Preencha nome e preço." });
    }

    const type = document.getElementById("update-product-type")?.value;
    const payload = { description, unitPrice, sku, unit };
    if (costPrice !== undefined && costPrice !== "") payload.costPrice = costPrice;
    if (type) payload.type = type;
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

  document.getElementById("btn-save-stock")?.addEventListener("click", async () => {
    const productId = document.getElementById("stock-product-id").value;
    const type = document.getElementById("stock-type").value;
    const quantity = document.getElementById("stock-qty").value;
    const unitCost = document.getElementById("stock-cost")?.value;
    const reason = document.getElementById("stock-reason").value.trim();
    const note = document.getElementById("stock-note").value.trim();

    if (!productId) return;

    if (!quantity || Number(quantity) <= 0) {
      return Swal.fire({ icon: "warning", title: "Quantidade inválida", text: "Informe uma quantidade válida." });
    }
    if (!reason) {
      return Swal.fire({ icon: "warning", title: "Motivo obrigatório", text: "Informe o motivo do movimento." });
    }

    const payload = { type, quantity, reason, note };
    if (type === "IN" && unitCost !== undefined && unitCost !== "") {
      payload.unitCost = unitCost;
    }

    const resp = await fetch(`/api/products/${productId}/stock`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const json = await resp.json().catch(() => ({}));
    if (!resp.ok || json.status !== "success") {
      return Swal.fire({ icon: "error", title: "Erro", text: json.message || "Erro ao ajustar stock" });
    }

    $("#stockModal").modal("hide");
    Swal.fire({ icon: "success", title: "Sucesso", text: "Stock atualizado", timer: 1200, showConfirmButton: false });
    await loadProducts();
  });

  // Re-render ao mudar orientação
  window.addEventListener("resize", function () {
    renderMobile(lastProducts);
  });

  function resetAddProductForm() {
    const form = document.getElementById("add-product-form");
    if (form) form.reset();

    document.getElementById("add-product-name").value = "";
    document.getElementById("add-product-sku").value = "";
    document.getElementById("add-product-unit").value = "un";
    document.getElementById("add-product-price").value = "";
    const addCostEl = document.getElementById("add-product-cost");
    if (addCostEl) addCostEl.value = "";
    document.getElementById("add-product-stock").value = 0;
    document.getElementById("add-product-min").value = 0;
  }

  $("#productModal").on("hidden.bs.modal", function () {
    resetAddProductForm();
  });

  function updateStockReasonOptions() {
    const typeEl = document.getElementById("stock-type");
    const reasonEl = document.getElementById("stock-reason");

    if (!typeEl || !reasonEl) return;

    const type = typeEl.value;

    // Mostra o preço de compra apenas em entradas
    const costWrap = document.getElementById("stock-cost-wrapper");
    if (costWrap) costWrap.style.display = type === "IN" ? "" : "none";

    if (type === "IN") {
      reasonEl.innerHTML = `
      <option value="">Selecione o motivo</option>
      <option value="purchase" selected>Compra</option>
      <option value="adjustment">Ajuste</option>
    `;
    } else if (type === "OUT") {
      reasonEl.innerHTML = `
      <option value="">Selecione o motivo</option>
      <option value="sale" selected>Venda</option>
      <option value="adjustment">Ajuste</option>
    `;
    } else {
      reasonEl.innerHTML = `
      <option value="" selected>Selecione o motivo</option>
    `;
    }
  }

  document.getElementById("stock-type")?.addEventListener("change", updateStockReasonOptions);
  updateStockReasonOptions()

  // ===== Toggle de campos de stock consoante tipo (produto vs serviço) =====
  function toggleAddStockFields(t) {
    const show = t !== 'service';
    document.querySelectorAll('.add-product-stock-field').forEach(el => {
      el.style.display = show ? '' : 'none';
    });
  }
  function toggleUpdateStockFields(t) {
    const show = t !== 'service';
    document.querySelectorAll('.update-product-stock-field').forEach(el => {
      el.style.display = show ? '' : 'none';
    });
  }
  // expor para uso no handler de edit
  window.toggleUpdateStockFields = toggleUpdateStockFields;

  document.getElementById("add-product-type")?.addEventListener("change", function () {
    toggleAddStockFields(this.value);
  });
  document.getElementById("update-product-type")?.addEventListener("change", function () {
    toggleUpdateStockFields(this.value);
  });
  // estado inicial
  toggleAddStockFields(document.getElementById("add-product-type")?.value || 'product');

  // init
  loadProducts().catch(console.error);
});