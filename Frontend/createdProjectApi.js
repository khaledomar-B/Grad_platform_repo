/* ================================
   createdProjectApi.js
   Student project overview + show supervisor weekly reports & comments
   ✅ FIX: match StudentsController routes:
      - GET /api/students/projects/{projectId}/weekly-reports
      - GET /api/students/projects/{projectId}/supervisor-comments
================================ */

// ✅ عدّل حسب بيئتك
const API_BASE_URL = "https://nonverbalized-gushier-alessandra.ngrok-free.dev";
const TOKEN_KEY = "token";

function handleLogout() {
  localStorage.removeItem(TOKEN_KEY);
  window.location.href = "/Auth_Pages/login.html";
}

document.addEventListener("DOMContentLoaded", () => {
  initMenuAndLogout();
  fillGreeting();
  loadMyProjectAndRender();
});

function fillGreeting() {
  const name = localStorage.getItem("studentName") || "طالب";
  const greeting = document.querySelector(".greeting-title");
  if (greeting) greeting.textContent = `مرحباً، ${name}! 👋`;
}

function initMenuAndLogout() {
  const menuToggle = document.getElementById("menuToggle");
  const sidebar = document.getElementById("sidebar");
  const body = document.body;

  if (!menuToggle || !sidebar) return;

  menuToggle.addEventListener("click", (e) => {
    e.stopPropagation();
    sidebar.classList.toggle("active");
    body.classList.toggle("sidebar-open");
    menuToggle.classList.toggle("open");
    menuToggle.setAttribute("aria-expanded", sidebar.classList.contains("active"));
  });

  document.addEventListener("click", (e) => {
    if (!sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
      sidebar.classList.remove("active");
      body.classList.remove("sidebar-open");
      menuToggle.classList.remove("open");
      menuToggle.setAttribute("aria-expanded", "false");
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      sidebar.classList.remove("active");
      body.classList.remove("sidebar-open");
      menuToggle.classList.remove("open");
      menuToggle.setAttribute("aria-expanded", "false");
    }
  });
}

function getToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

function authHeaders(extra = {}) {
  const token = getToken();
  const h = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "ngrok-skip-browser-warning": "true",
    ...extra,
  };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: { ...authHeaders(options.headers || {}) },
    cache: "no-store",
  });

  if (res.status === 401 || res.status === 403) {
    localStorage.removeItem(TOKEN_KEY);
    window.location.href = "/Auth_Pages/login.html";
    return null;
  }

  if (res.status === 204) return null;

  const ct = res.headers.get("content-type") || "";
  const data = ct.includes("application/json") ? await res.json() : await res.text();

  if (!res.ok) {
    const msg =
      (data && data.message) ||
      (typeof data === "string" ? data : "") ||
      `HTTP ${res.status}`;
    throw new Error(msg);
  }

  return data;
}

async function loadMyProjectAndRender() {
  const token = getToken();
  if (!token) {
    window.location.href = "/Auth_Pages/login.html";
    return;
  }

  // ✅ مشروع الطالب
  const project = await apiFetch(`/api/projects/my`, { method: "GET" });
  if (!project) return;

  // ✅ بعض APIs بيرجعوا projectId بدل id
  const projectId = project.projectId ?? project.id ?? null;

  // summary + team
  setText("#projectName", project.title || "—");
  setText("#projectDesc", project.description || "—");
  setText("#projectStatus", project.status || "—");
  renderTeam(project.members || []);

  // pending mode
  const status = String(project.status || "").toLowerCase();
  const isPending = status === "pending";
  applyPendingMode(isPending);

  // timeline + (تقارير/ملاحظات) فقط إذا مش Pending
  if (!isPending) {
    renderTimelineFromApi(project.milestones || []);

    if (projectId) {
      await loadAndRenderWeeklyReports(projectId);
      await loadAndRenderSupervisorComments(projectId);
    }
  }
}

/* ================================
   Pending Mode UI
================================ */
function applyPendingMode(isPending) {
  const timelineCard = document.querySelector(".progress-timeline-card");
  const weeklyCard = document.getElementById("weeklyReportsCard");
  const commentsCard = document.getElementById("supervisorCommentsCard");

  let banner = document.getElementById("pendingBanner");
  if (!banner) {
    banner = document.createElement("div");
    banner.id = "pendingBanner";
    banner.style.cssText = `
      background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;
      padding:12px 14px;border-radius:12px;margin:16px 0;font-weight:700;
    `;
    banner.textContent =
      "مشروعك قيد المراجعة (Pending) — بانتظار موافقة المشرف لفتح المراحل والتسليمات.";
    const main = document.querySelector(".main-content");
    if (main) main.insertBefore(banner, main.children[1] || null);
  }

  banner.style.display = isPending ? "block" : "none";
  if (timelineCard) timelineCard.style.display = isPending ? "none" : "";
  if (weeklyCard) weeklyCard.style.display = isPending ? "none" : "";
  if (commentsCard) commentsCard.style.display = isPending ? "none" : "";
}

/* ================================
   Team Render
================================ */
function renderTeam(members) {
  const list = document.getElementById("teamMembersList");
  if (!list) return;

  if (!members.length) {
    list.innerHTML = `
      <div class="team-member-badge">
        <span class="member-initial">—</span>
        <span class="member-name">لا يوجد أعضاء</span>
      </div>`;
    return;
  }

  list.innerHTML = members
    .map((m) => {
      const name = m.studentName || m.name || "—";
      const initial = (name.trim()[0] || "؟").toUpperCase();
      return `
        <div class="team-member-badge">
          <span class="member-initial">${escapeHtml(initial)}</span>
          <span class="member-name">${escapeHtml(name)}</span>
        </div>
      `;
    })
    .join("");
}

/* ================================
   Timeline
================================ */
function renderTimelineFromApi(milestones) {
  const steps = document.querySelectorAll(".timeline-step"); // data-phase=1..6
  const lines = document.querySelectorAll(".line");

  steps.forEach((s) => s.classList.remove("active", "completed"));
  lines.forEach((l) => l.classList.remove("active"));

  const map = new Map();
  for (const m of milestones) {
    if (m.order == null) continue;
    map.set(String(m.order), String(m.status || "").toLowerCase());
  }

  steps.forEach((step, index) => {
    const phase = step.dataset.phase;
    const st = map.get(String(phase));
    if (!st) return;

    if (st === "approved" || st === "completed" || st === "done") {
      step.classList.add("completed");
      if (lines[index - 1]) lines[index - 1].classList.add("active");
      return;
    }

    if (st === "open" || st === "submitted" || st === "active") {
      step.classList.add("active");
      if (lines[index - 1]) lines[index - 1].classList.add("active");
      return;
    }
  });
}

/* ================================
   Weekly Reports (Student view)
   expected: [{ id, weekNumber, title, content, createdAt }]
   ✅ FIX: route => /api/students/projects/{projectId}/weekly-reports
================================ */
async function loadAndRenderWeeklyReports(projectId) {
  const weeklyEmpty = document.getElementById("weeklyEmpty");
  const container = document.getElementById("weeklyReportsContainer");
  if (!container) return;

  const data = await apiFetch(`/api/students/projects/${projectId}/weekly-reports`, { method: "GET" });
  const arr = Array.isArray(data) ? data : [];

  if (arr.length === 0) {
    if (weeklyEmpty) weeklyEmpty.style.display = "block";
    container.style.display = "none";
    container.innerHTML = "";
    return;
  }

  if (weeklyEmpty) weeklyEmpty.style.display = "none";
  container.style.display = "block";

  container.innerHTML = arr
    .map((r) => {
      const week = r.weekNumber ?? "-";
      const title = escapeHtml(r.title || "تقرير أسبوعي");
      const content = escapeHtml(r.content || "");
      const date = formatArDate(r.createdAt);

      return `
        <div class="weekly-report-item" style="background:#fff;border:1px solid #eef2f7;border-radius:12px;padding:14px;margin:10px 0;">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
            <div style="font-weight:800;color:#0f3b57;">الأسبوع ${week} — ${title}</div>
            <div style="font-size:12px;color:#6b7280;">${date}</div>
          </div>
          <div style="margin-top:10px;color:#1f2937;line-height:1.8;white-space:pre-wrap;">${content}</div>
        </div>
      `;
    })
    .join("");
}

/* ================================
   Supervisor Comments (Student view)
   expected: [{ id, title, content, createdAt }]
   ✅ FIX: route => /api/students/projects/{projectId}/supervisor-comments
================================ */
async function loadAndRenderSupervisorComments(projectId) {
  const container = document.getElementById("commentsContainer");
  if (!container) return;

  const data = await apiFetch(`/api/students/projects/${projectId}/supervisor-comments`, { method: "GET" });
  const arr = Array.isArray(data) ? data : [];

  if (arr.length === 0) {
    container.innerHTML = `
      <div class="comments-empty">
        <i class="bi bi-chat-left-text"></i>
        <p>لا توجد ملاحظات بعد<br>سيتم عرض ملاحظات المشرف هنا</p>
      </div>
    `;
    return;
  }
    
  container.innerHTML = arr
    .map((c) => {
      const title = escapeHtml(c.title || "ملاحظة");
      const content = escapeHtml(c.content || "");
      const date = formatArDate(c.createdAt);

      return `
        <div class="comment-item" style="background:#fff;border:1px solid #eef2f7;border-radius:12px;padding:14px;margin:10px 0;">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
            <div style="font-weight:800;color:#9a3412;">${title}</div>
            <div style="font-size:12px;color:#6b7280;">${date}</div>
          </div>
          <div style="margin-top:10px;color:#1f2937;line-height:1.8;white-space:pre-wrap;">${content}</div>
        </div>
      `;
    })
    .join("");
}

/* ================================
   Helpers
================================ */
function setText(selector, value) {
  const el = document.querySelector(selector);
  if (el) el.textContent = value;
}

function formatArDate(d) {
  try {
    return new Date(d).toLocaleString("ar-EG");
  } catch {
    return "";
  }
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[m]));
}               

