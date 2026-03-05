document.addEventListener("DOMContentLoaded", function () {
  const $product = document.getElementById("filterProduct");
  const $type = document.getElementById("filterType");
  const $start = document.getElementById("filterStartDate");
  const $end = document.getElementById("filterEndDate");

  // ====== MOBILE LIST (CARDS + LOAD MORE) ======
  const $mobileList = document.getElementById("stockMovementsMobileList");
  const isMobile = () => window.innerWidth < 768;

  let currentMovements = [];
  let mobilePageSize = 10;     // quantos cards por "página"
  let mobileVisibleCount = 10; // quantos estão visíveis agora

  function normalizeType(t) {
    const v = (t || "").toString().toUpperCase().trim();
    if (v === "IN") return { label: "Entrada", cls: "in", icon: "fa-arrow-down" };
    if (v === "OUT") return { label: "Saída", cls: "out", icon: "fa-arrow-up" };
    if (v === "ADJUST") return { label: "Ajuste", cls: "adj", icon: "fa-sliders" };
    return { label: v || "Ajuste", cls: "adj", icon: "fa-sliders" };
  }

  function resetMobilePagination() {
    mobileVisibleCount = mobilePageSize;
  }

  function renderMobileCards() {
    if (!$mobileList) return;

    // só renderiza no mobile
    if (!isMobile()) {
      $mobileList.innerHTML = "";
      return;
    }

    if (!currentMovements.length) {
      $mobileList.innerHTML = `
        <div class="text-center text-muted py-4">
          Sem movimentos para mostrar.
        </div>
      `;
      return;
    }

    const slice = currentMovements.slice(0, mobileVisibleCount);

    const cardsHtml = slice
      .map((m) => {
        const p = m.productId || {};
        const date = formatDateTime(m.createdAt);
        const product = p.description || "-";
        const code = p.sku || "-";
        const qty = m.quantity ?? "-";
        const reason = m.reason || "-";

        const t = normalizeType(m.type);

        return `
          <div class="mv-card">
            <div class="mv-top">
              <div class="mv-product">${product}</div>
              <div class="mv-date">${date}</div>
            </div>

            <div class="mv-meta">
              <span class="mv-pill">
                <i class="fa-solid fa-barcode"></i>
                <code>${code}</code>
              </span>

              <span class="mv-pill">
                <i class="fa-solid ${t.icon}"></i>
                <span class="mv-type ${t.cls}">${t.label}</span>
              </span>

              <span class="mv-pill">
                <i class="fa-solid fa-hashtag"></i>
                <span class="mv-qty">${qty}</span>
              </span>
            </div>

            <div class="mv-reason">
              <strong>Motivo:</strong> ${reason}
            </div>
          </div>
        `;
      })
      .join("");

    const showing = Math.min(mobileVisibleCount, currentMovements.length);
    const total = currentMovements.length;

    const hasMore = showing < total;

    const footerHtml = `
      <div class="d-flex flex-column align-items-center py-2">
        <div class="text-muted mb-2" style="font-size:.85rem;">
          A mostrar <strong>${showing}</strong> de <strong>${total}</strong>
        </div>

        ${
          hasMore
            ? `<button class="btn btn-outline-primary btn-sm w-100" id="btnMobileLoadMore">
                 <i class="fa-solid fa-plus"></i> Carregar mais
               </button>`
            : `<div class="text-muted" style="font-size:.85rem;">Fim da lista</div>`
        }
      </div>
    `;

    $mobileList.innerHTML = cardsHtml + footerHtml;

    // bind do botão (recriado a cada render)
    const $btn = document.getElementById("btnMobileLoadMore");
    if ($btn) {
      $btn.addEventListener("click", function () {
        mobileVisibleCount = Math.min(mobileVisibleCount + mobilePageSize, currentMovements.length);
        renderMobileCards();
      });
    }
  }
  // ====== /MOBILE LIST ======

  const table = $("#stockMovementsTable").DataTable({
    pageLength: 25,
    lengthMenu: [10, 25, 50, 100],
    order: [[0, "desc"]],
  });

  function formatDateTime(iso) {
    if (!iso) return "-";
    const d = new Date(iso);
    return new Intl.DateTimeFormat("pt-MZ", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  }

  function typeLabel(t) {
    if (t === "IN") return `<span class="badge badge-success w-100">Entrada</span>`;
    if (t === "OUT") return `<span class="badge badge-danger w-100">Saída</span>`;
    if (t === "ADJUST") return `<span class="badge badge-warning w-100">Ajuste</span>`;
    return t || "-";
  }

  async function loadProductsSelect() {
    const res = await fetch("/api/products?includeInactive=true");
    const data = await res.json();

    if (data.status !== "success") return;

    const products = data.products || [];
    products.forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p._id;
      opt.textContent = p.sku ? `${p.description} (${p.sku})` : p.description;
      $product.appendChild(opt);
    });
  }

  function buildQuery() {
    const params = new URLSearchParams();

    if ($product.value) params.set("productId", $product.value);
    if ($type.value) params.set("type", $type.value);
    if ($start.value) params.set("startDate", $start.value);
    if ($end.value) params.set("endDate", $end.value);

    return params.toString() ? `?${params.toString()}` : "";
  }

  async function loadMovements() {
    const query = buildQuery();
    const res = await fetch(`/api/stock-movements${query}`);
    const data = await res.json();

    if (data.status !== "success") {
      Swal.fire({ icon: "error", title: "Erro", text: data.message || "Erro ao carregar movimentos" });
      return;
    }

    const movements = data.movements || [];

    // MOBILE dataset + reset paginação
    currentMovements = movements;
    resetMobilePagination();
    renderMobileCards();

    // DESKTOP DataTable
    table.clear();

    movements.forEach((m) => {
      const p = m.productId || {};
      table.row.add([
        formatDateTime(m.createdAt),
        p.description || "-",
        `<span class="d-block text-center">${p.sku || "-"}</span>`,
        `<span class="d-block text-center">${typeLabel(m.type)}</span>`,
        `<span class="d-block text-center">${m.quantity}</span>`,
        m.reason || "-",
      ]);
    });

    table.draw(false);
  }

  document.getElementById("btnApplyFilters").addEventListener("click", loadMovements);

  document.getElementById("btnClearFilters").addEventListener("click", async () => {
    $product.value = "";
    $type.value = "";
    $start.value = "";
    $end.value = "";
    await loadMovements();
  });

  // se o user rodar o ecrã (portrait/landscape), re-render (sem resetar contagem)
  window.addEventListener("resize", renderMobileCards);

  // init
  loadProductsSelect()
    .then(loadMovements)
    .catch(console.error);
});