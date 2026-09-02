const API_BASE_URL = "https://nonverbalized-gushier-alessandra.ngrok-free.dev";

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
  // logout (الزر موجود onclick="handleLogout()")
  window.handleLogout = () => {
    window.location.href = "/student/login.html";
  };

  // menu toggle
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

async function loadMyProjectAndRender() {
  const token = localStorage.getItem("token");
  if (!token) {
    window.location.href = "Auth_Pages/login.html";
    return;
  }

  const res = await fetch(`${API_BASE_URL}/api/projects/my`, {
  headers: {
    Authorization: `Bearer ${token}`,
    "Accept": "application/json",
    "ngrok-skip-browser-warning": "true"
  },
  cache: "no-store"
});


  if (res.status === 404) {
    window.location.href = "dashboard.html";
    return;
  }

  if (!res.ok) {
    console.error("Failed to load /api/projects/my");
    return;
  }

  const project = await res.json();

  // summary + team
  setText("#projectName", project.title || "—");
  setText("#projectDesc", project.description || "—");
  setText("#projectStatus", project.status || "—");
  renderTeam(project.members || []);

  const params = new URLSearchParams(window.location.search);
const urlMode = params.get("mode");
const status = (project.status || "").toLowerCase();

// ✅ إذا المشروع Active و URL فيه mode=pending → نظّف الرابط
if (status !== "pending" && urlMode === "pending") {
  params.delete("mode");
  const newUrl = `${window.location.pathname}${params.toString() ? "?" + params.toString() : ""}`;
  window.history.replaceState({}, "", newUrl);
}

// ✅ Pending فقط إذا الحالة Pending (أو إذا بدك: AND مع urlMode)
const isPending = status === "pending";
applyPendingMode(isPending);


  // ✅ ارسم المراحل والتعليقات فقط إذا مش Pending
  if (!isPending) {
    renderTimelineFromApi(project.milestones || []);
    renderCommentsEmpty();
  }
}

function applyPendingMode(isPending) {
  const timelineCard = document.querySelector(".progress-timeline-card");
  const weeklyCard = document.querySelector(".weekly-reports-card");
  const commentsCard = document.querySelector(".supervisor-comments-card");

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
      const name = m.studentName || "—";
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

function renderTimelineFromApi(milestones) {
  const steps = document.querySelectorAll(".timeline-step"); // data-phase=1..6
  const lines = document.querySelectorAll(".line");

  // reset
  steps.forEach((s) => s.classList.remove("active", "completed"));
  lines.forEach((l) => l.classList.remove("active"));

  // map order -> status
  const map = new Map();
  for (const m of milestones) {
    if (m.order == null) continue;
    map.set(String(m.order), String(m.status || "").toLowerCase());
  }

  steps.forEach((step, index) => {
    const phase = step.dataset.phase; // "1".."6"
    const st = map.get(String(phase));
    if (!st) return;

    // Approved/Completed => completed
    if (st === "approved" || st === "completed" || st === "done") {
      step.classList.add("completed");
      if (lines[index - 1]) lines[index - 1].classList.add("active");
      return;
    }

    // Open/Submitted/Active => active
    if (st === "open" || st === "submitted" || st === "active") {
      step.classList.add("active");
      if (lines[index - 1]) lines[index - 1].classList.add("active");
      return;
    }

    // Locked => لا شيء (تبقى رمادي)
  });
}

function renderCommentsEmpty() {
  const container = document.getElementById("commentsContainer");
  if (!container) return;

  container.innerHTML = `
    <div class="comments-empty">
      <i class="bi bi-chat-left-text"></i>
      <p>لا توجد ملاحظات بعد<br>سيتم عرض ملاحظات المشرف هنا</p>
    </div>
  `;
}

function setText(selector, value) {
  const el = document.querySelector(selector);
  if (el) el.textContent = value;
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
