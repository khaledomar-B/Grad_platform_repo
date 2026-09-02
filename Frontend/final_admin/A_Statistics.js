// A_Statistics.js
let majorBarChart, statusPieChart, categoryBarChart;

const API_BASE = "https://nonverbalized-gushier-alessandra.ngrok-free.dev";

function setLastUpdated(text) {
  const el = document.getElementById("lastUpdated");
  if (!el) return;

  el.textContent = "آخر تحديث: " + text;
}

function setKpis(summary) {
  document.getElementById("kpiTotal").textContent = summary.totalProjects ?? "—";
  document.getElementById("kpiInProgress").textContent = summary.inProgress ?? "—";
  document.getElementById("kpiCompleted").textContent = summary.completed ?? "—";
  document.getElementById("kpiPending").textContent = summary.pendingReview ?? "—";
}

function renderMajorBar(majors) {
  if (!majors || majors.length === 0) return;

  const canvas = document.getElementById("majorBarChart");
  if (!canvas) return;

  if (majorBarChart) majorBarChart.destroy();

  majorBarChart = new Chart(canvas, {
    type: "bar",
    data: {
      labels: majors.map(x => x.major),
      datasets: [{
        label: "عدد المشاريع",
        data: majors.map(x => x.count),
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { y: { beginAtZero: true } }
    }
  });
}

function renderStatusPie(status) {
  if (!status || status.length === 0) return;

  const canvas = document.getElementById("statusPieChart");
  if (!canvas) return;

  if (statusPieChart) statusPieChart.destroy();

  statusPieChart = new Chart(canvas, {
    type: "pie",
    data: {
      labels: status.map(x => x.status),
      datasets: [{
        data: status.map(x => x.count)
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false
    }
  });
}

function renderCategoryBar(categories) {
  if (!categories || categories.length === 0) return;

  const canvas = document.getElementById("categoryBarChart");
  if (!canvas) return;

  if (categoryBarChart) categoryBarChart.destroy();

  categoryBarChart = new Chart(canvas, {
    type: "bar",
    data: {
      labels: categories.map(x => x.category),
      datasets: [{
        label: "عدد المشاريع",
        data: categories.map(x => x.count),
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { y: { beginAtZero: true } }
    }
  });
}

async function fetchJson(url, timeoutMs = 8000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "Accept": "application/json",
        // ✅ مهم مع ngrok (يتجنب صفحة التحذير HTML أحيانًا)
        "ngrok-skip-browser-warning": "true"
      },
      signal: controller.signal
    });

    const text = await res.text();

    if (!res.ok) {
      console.error("❌ HTTP Error", res.status, "URL:", url);
      console.error("❌ Response (first 200 chars):", text.slice(0, 200));
      throw new Error(`HTTP ${res.status}`);
    }

    try {
      return JSON.parse(text);
    } catch (e) {
      console.error("❌ Not JSON from:", url);
      console.error("❌ First 200 chars:", text.slice(0, 200));
      throw e;
    }
  } finally {
    clearTimeout(t);
  }
}

async function loadStats() {
  setLastUpdated(new Date().toLocaleString("ar-JO"));

  const endpoints = {
    summary: `${API_BASE}/api/admin/stats/summary`,
    majors: `${API_BASE}/api/admin/stats/by-major`,
    status: `${API_BASE}/api/admin/stats/by-status`,
    categories: `${API_BASE}/api/admin/stats/by-category`
  };

  const results = await Promise.allSettled([
    fetchJson(endpoints.summary, 25000),
    fetchJson(endpoints.majors, 25000),
    fetchJson(endpoints.status, 25000),
    fetchJson(endpoints.categories, 25000)
  ]);

  const [summaryRes, majorsRes, statusRes, catRes] = results;

  if (summaryRes.status === "fulfilled") setKpis(summaryRes.value);
  else console.error("❌ summary failed", summaryRes.reason);

  if (majorsRes.status === "fulfilled") renderMajorBar(majorsRes.value);
  else console.error("❌ by-major failed", majorsRes.reason);

  if (statusRes.status === "fulfilled") renderStatusPie(statusRes.value);
  else console.error("❌ by-status failed", statusRes.reason);

  if (catRes.status === "fulfilled") renderCategoryBar(catRes.value);
  else console.error("❌ by-category failed", catRes.reason);
}


function wireSidebarToggle() {
  const btn = document.getElementById("menuToggle");
  const sidebar = document.getElementById("sidebar");
  if (!btn || !sidebar) return;

  btn.addEventListener("click", () => {
    sidebar.classList.toggle("active");
  });
}

// ✅ Fix: Report/Print button
function setupReportButton() {
  const btn = document.getElementById("btnReport");
  if (!btn) {
    console.warn("⚠️ btnReport not found in HTML");
    return;
  }

  // مهم إذا الزر داخل form
  btn.setAttribute("type", "button");

  btn.addEventListener("click", () => {
    const now = new Date();

    const printDate = document.getElementById("printDate");
    const printUpdated = document.getElementById("printUpdated");
    const lastUpdated = document.getElementById("lastUpdated");

    if (printDate) printDate.textContent = now.toLocaleString("ar-JO");
    if (printUpdated) {
      printUpdated.textContent = lastUpdated
        ? lastUpdated.textContent.replace("آخر تحديث: ", "")
        : now.toLocaleString("ar-JO");
    }

    // Give charts a moment to finish drawing
    setTimeout(() => window.print(), 300);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  wireSidebarToggle();
  loadStats();
  setupReportButton(); // ✅ مهم
});
