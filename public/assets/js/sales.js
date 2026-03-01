document.addEventListener("DOMContentLoaded", function () {
    const $ = (id) => document.getElementById(id);

    const tableEl = $("#salesTable");
    let dt = null;

    const state = {
        sales: [],
        filters: { start: "", end: "", status: "", payment: "" }
    };

    function formatCurrency(v) {
        return new Intl.NumberFormat("pt-MZ", {
            style: "currency",
            currency: "MZN",
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(Number(v || 0)).replace("MTn", "MZN");
    }

    function shortId(id) {
        return String(id || "").slice(-8).toUpperCase();
    }

    function badgeStatus(status) {
        if (status === "cancelled") return `<span class="badge badge-danger">Cancelada</span>`;
        return `<span class="badge badge-success">Confirmada</span>`;
    }

    function safe(v, fallback = "—") {
        if (v === null || v === undefined || v === "") return fallback;
        return v;
    }

    function calcPaid(sale) {
        return sale.paidAmount ?? sale.total ?? 0;
    }

    function calcChange(sale) {
        return (sale.paidAmount ?? sale.total ?? 0) - (sale.total ?? 0);
    }

    function inRange(dateStr, start, end) {
        if (!dateStr) return true;
        const d = new Date(dateStr);
        if (start) {
            const s = new Date(start + "T00:00:00");
            if (d < s) return false;
        }
        if (end) {
            const e = new Date(end + "T23:59:59");
            if (d > e) return false;
        }
        return true;
    }

    function applyFilters(list) {
        const { start, end, status, payment } = state.filters;

        return list.filter(s => {
            const okDate = inRange(s.createdAt, start, end);
            const okStatus = status ? s.status === status : true;
            const okPay = payment ? (s.paymentMethod === payment) : true;
            return okDate && okStatus && okPay;
        });
    }

    function updateKPIs(list) {
        const now = new Date();
        const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const start7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        const confirmed = list.filter(s => s.status === "confirmed");
        const cancelled = list.filter(s => s.status === "cancelled");

        const todaySum = confirmed
            .filter(s => new Date(s.createdAt) >= startToday)
            .reduce((sum, s) => sum + (s.total || 0), 0);

        const weekSum = confirmed
            .filter(s => new Date(s.createdAt) >= start7)
            .reduce((sum, s) => sum + (s.total || 0), 0);

        const totalSum = confirmed.reduce((sum, s) => sum + (s.total || 0), 0);

        $("kpi-today").textContent = formatCurrency(todaySum);
        $("kpi-week").textContent = formatCurrency(weekSum);
        $("kpi-total").textContent = formatCurrency(totalSum);
        $("kpi-cancelled").textContent = String(cancelled.length);
    }

    function buildRows(list) {
        const rows = list.map(sale => {
            const receipt = safe(sale.receiptNumber, shortId(sale._id));
            const itemsCount = (sale.items || []).reduce((n, i) => n + (i.quantity || 0), 0);
            const paid = calcPaid(sale);
            const change = calcChange(sale);

            const pdfUrl = `/api/sales/${sale._id}/receipt`; // cria esta rota se não existir
            const canCancel = sale.status !== "cancelled";

            return `
        <tr>
          <td class="text-center"><strong>${receipt}</strong></td>
          <td class="text-center">${itemsCount}</td>
          <td class="text-center">${formatCurrency(sale.total)}</td>
          <td class="text-center">${formatCurrency(paid)}</td>
          <td class="text-center">${formatCurrency(change > 0 ? change : 0)}</td>
          <td class="text-center">${safe(sale.paymentMethod, "—")}</td>
          <td class="text-center">${new Date(sale.createdAt).toLocaleString("pt-MZ")}</td>
          <td class="text-center">${badgeStatus(sale.status)}</td>
          <td class="text-center">
            <a class="btn btn-sm btn-outline-primary" target="_blank" href="${pdfUrl}">
              <i class="fa-solid fa-receipt mr-1"></i> Recibo
            </a>
            <button class="btn btn-sm btn-outline-danger btn-cancel-sale" data-id="${sale._id}" data-receipt="${receipt}"
              ${canCancel ? "" : "disabled"}>
              <i class="fa-solid fa-ban mr-1"></i> Cancelar
            </button>
          </td>
        </tr>
      `;
        }).join("");

        document.querySelector("#salesTable tbody").innerHTML = rows;
        $("sales-count").textContent = `${list.length} venda(s)`;
    }

    function initDataTable() {
        if (dt) {
            dt.destroy();
            dt = null;
        }
        dt = tableEl.DataTable({
            order: [[6, "desc"]],
            pageLength: 10,
            language: {
                url: "assets/vendor/datatables/pt-PT.json" // opcional (se tiveres)
            }
        });
    }

    async function loadSales() {
        const res = await fetch("/api/sales");
        const data = await res.json();

        // se teu backend retorna direto array, adapta:
        state.sales = Array.isArray(data) ? data : (data.sales || []);

        const filtered = applyFilters(state.sales);
        updateKPIs(state.sales);
        buildRows(filtered);
        initDataTable();
    }

    // Filter handlers
    $("btn-apply-filters").addEventListener("click", function () {
        state.filters.start = $("filterStart").value;
        state.filters.end = $("filterEnd").value;
        state.filters.status = $("filterStatus").value;
        state.filters.payment = $("filterPayment").value;

        const filtered = applyFilters(state.sales);
        buildRows(filtered);
        initDataTable();
    });

    $("btn-clear-filters").addEventListener("click", function () {
        $("filterStart").value = "";
        $("filterEnd").value = "";
        $("filterStatus").value = "";
        $("filterPayment").value = "";

        state.filters = { start: "", end: "", status: "", payment: "" };

        buildRows(state.sales);
        initDataTable();
    });

    // Cancel modal
    document.addEventListener("click", function (e) {
        const btn = e.target.closest(".btn-cancel-sale");
        if (!btn) return;

        $("cancelSaleId").value = btn.dataset.id;
        $("cancelSaleInfo").textContent = `Recibo: ${btn.dataset.receipt}`;
        $("#cancelSaleModal").modal("show");
    });

    $("btn-confirm-cancel").addEventListener("click", async function () {
        const id = $("cancelSaleId").value;
        if (!id) return;

        try {
            // Ajusta o endpoint conforme tua rota
            const res = await fetch(`/api/sales/${id}/cancel`, { method: "PATCH" });
            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                alert(data.message || "Erro ao cancelar venda.");
                return;
            }

            $("#cancelSaleModal").modal("hide");
            await loadSales();
        } catch (err) {
            console.error(err);
            alert("Erro ao cancelar venda.");
        }
    });

    // Export (placeholder)
    document.getElementById("btn-export-sales").addEventListener("click", function () {
        const startDate = document.getElementById("filterStart").value;
        const endDate = document.getElementById("filterEnd").value;
        const status = document.getElementById("filterStatus").value;
        const paymentMethod = document.getElementById("filterPayment").value;

        const params = new URLSearchParams();
        if (startDate) params.set("startDate", startDate);
        if (endDate) params.set("endDate", endDate);
        if (status) params.set("status", status);
        if (paymentMethod) params.set("paymentMethod", paymentMethod);

        window.location.href = `/api/sales/export?${params.toString()}`;
    });

    loadSales();
});