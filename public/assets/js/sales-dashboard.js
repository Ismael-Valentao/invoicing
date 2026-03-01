document.addEventListener("DOMContentLoaded", () => {
  const currency = (v) =>
    new Intl.NumberFormat("pt-MZ", {
      style: "currency",
      currency: "MZN",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
      .format(Number(v || 0))
      .replace("MTn", "MZN");

  const formatDate = (d) => {
    if (!d) return "";
    const x = new Date(d);
    return x.toLocaleDateString("pt-PT");
  };

  let areaChart = null;
  let pieChart = null;

  async function loadDashboard() {
    const days = document.getElementById("range")?.value || 30;

    const res = await fetch(`/api/sales/dashboard-info?days=${days}`);
    const data = await res.json();

    if (!res.ok || data.status !== "success") {
      Swal?.fire?.({ icon: "error", title: "Erro", text: data.message || "Falha ao carregar dashboard" });
      return;
    }

    // Cards
    document.getElementById("total-sold").textContent = currency(data.cards.totalSold);
    document.getElementById("total-sales").textContent = data.cards.totalSales ?? 0;
    document.getElementById("cancelled-sales").textContent = data.cards.cancelledSales ?? 0;

    document.getElementById("last-sale").textContent = data.cards.lastSale
      ? `${currency(data.cards.lastSale.total)}`
      : "—";

    // Área: vendas por dia
    const labels = (data.charts.byDay || []).map(x => x.date);
    const values = (data.charts.byDay || []).map(x => Number(x.total || 0));

    const ctxArea = document.getElementById("salesAreaChart");
    if (areaChart) areaChart.destroy();

    areaChart = new Chart(ctxArea, {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: "Total vendido",
          data: values,
          fill: true,
          tension: 0.3
        }]
      },
      options: {
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: {
            ticks: {
              callback: (val) => currency(val)
            }
          }
        }
      }
    });

    // Pizza: pagamentos
    const payLabels = (data.charts.payments || []).map(x => x.label);
    const payValues = (data.charts.payments || []).map(x => Number(x.total || 0));

    const ctxPie = document.getElementById("paymentsPieChart");
    if (pieChart) pieChart.destroy();

    pieChart = new Chart(ctxPie, {
      type: "doughnut",
      data: {
        labels: payLabels,
        datasets: [{
          data: payValues
        }]
      },
      options: {
        maintainAspectRatio: false,
        plugins: { legend: { display: false } }
      }
    });

    // legenda simples
    const legend = document.getElementById("paymentLegend");
    if (legend) {
      legend.innerHTML = payLabels.map((l, i) => `
        <span class="mr-3">
          <i class="fas fa-circle"></i> ${l}: <strong>${currency(payValues[i])}</strong>
        </span>
      `).join("");
    }
  }

  document.getElementById("btn-refresh")?.addEventListener("click", loadDashboard);
  document.getElementById("range")?.addEventListener("change", loadDashboard);

  loadDashboard().catch(console.error);
});