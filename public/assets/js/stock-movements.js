document.addEventListener("DOMContentLoaded", function () {
  const $product = document.getElementById("filterProduct");
  const $type = document.getElementById("filterType");
  const $start = document.getElementById("filterStartDate");
  const $end = document.getElementById("filterEndDate");

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
    console.log(movements)

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

  // init
  loadProductsSelect()
    .then(loadMovements)
    .catch(console.error);
});