const btnApply = document.getElementById("btn-apply-filters");
const btnExcel = document.getElementById("btn-export-excel");
const summaryCards = document.getElementById("summary-cards");

/* =========================
   Utils
========================= */
function getFilters() {
    return {
        client: document.getElementById("filter-client").value,
        status: document.getElementById("filter-status").value,
        startDate: document.getElementById("filter-start").value,
        endDate: document.getElementById("filter-end").value,
    };
}

function hasActiveFilters(filters) {
    return (
        (filters.client && filters.client !== "all") ||
        (filters.status && filters.status !== "all") ||
        filters.startDate ||
        filters.endDate
    );
}

function buildQueryString(filters) {
    const params = new URLSearchParams();

    Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== "all") {
            params.append(key, value);
        }
    });

    return params.toString();
}

async function fetchResumo(filters) {
    const query = buildQueryString(filters);
    const res = await fetch(`/api/invoices/summary?${query}`);
    const resume = await res.json()
    console.log(resume)
    return resume
}

function renderResumo(data) {
    document.getElementById("summary-total-invoices").innerText =
        data.totalInvoices;

    document.getElementById("summary-total-amount").innerText =
        data.totalAmount?.toLocaleString("pt-MZ") + " MT";

    document.getElementById("summary-paid").innerText =
        data.paidAmount?.toLocaleString("pt-MZ") + " MT";

    document.getElementById("summary-unpaid").innerText =
        data.unpaidAmount?.toLocaleString("pt-MZ") + " MT";
}

async function fetchPreview(filters) {
    const query = buildQueryString(filters);
    const res = await fetch(`/api/invoices/preview?${query}`);
    return await res.json();
}

function statusBadge(status) {
    switch (status) {
        case "paid": return '<span class="badge-status badge-paid w-100">Pago</span>';
        case "unpaid": return '<span class="badge-status badge-unpaid w-100">Pendente</span>';
        case "overdue": return '<span class="badge-status badge-overdue w-100">Vencido</span>';
        case "pending": return '<span class="badge-status badge-pending w-100">Pendente</span>';
        default: return status;
    }
}

function renderTabela(invoices) {
    const tbody = document.querySelector("#reportTable tbody");
    tbody.innerHTML = "";

    invoices.forEach((inv, index) => {
        tbody.insertAdjacentHTML(
            "beforeend",
            `
            <tr>
                <td>${index + 1}</td>
                <td>${inv.clientName}</td>
                <td>${inv.date}</td>
                <td>${inv.subTotal?.toLocaleString("pt-MZ")} MT</td>
                <td>${inv.tax?.toLocaleString("pt-MZ")} MT</td>
                <td>${inv.totalAmount?.toLocaleString("pt-MZ")} MT</td>
                <td>${statusBadge(inv.status)}</td>
            </tr>
            `
        );
    });
}



/* =========================
   Apply Filters
========================= */
async function applyFilters() {
    const filters = getFilters();

    btnApply.disabled = true;
    btnApply.innerText = "A carregar...";

    try {
        const summary = await fetchResumo(filters);
        renderResumo(summary);

        const preview = await fetchPreview(filters);
        console.log(preview)
        renderTabela(preview.invoices);

        summaryCards.style.display = "flex";
        btnExcel.disabled = false;
    } catch (err) {
        console.error(err);
        alert("Erro ao aplicar filtros");
    }

    btnApply.innerHTML = '<i class="fa fa-search"></i> Aplicar filtros';
    btnApply.disabled = false;
}


/* =========================
   Export Excel
========================= */
btnExcel.addEventListener("click", () => {
    const filters = getFilters();
    const useFilter = hasActiveFilters(filters);

    let url = `/api/invoices/export/excel/${useFilter || true}`;

    if (useFilter) {
        const queryString = buildQueryString(filters);
        if (queryString) {
            url += `?${queryString}`;
        }
    }

    // download direto
    window.location.href = url;
});

/* =========================
   Events
========================= */
btnApply.addEventListener("click", async () => {
    btnApply.disabled = true;
    btnApply.innerText = "A carregar...";

    await applyFilters();

    btnApply.innerHTML = '<i class="fa fa-search"></i> Aplicar filtros';
    btnApply.disabled = false;
});

document.addEventListener("DOMContentLoaded", async () => {
    const options = await getClientsOptions();
    document
        .getElementById("filter-client")
        .insertAdjacentHTML("beforeend", options);
});


