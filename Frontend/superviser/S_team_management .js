// ================================
// Config
// ================================
const TOKEN_KEY = "token";
const API_BASE_URL = window.API_BASE_URL || "https://nonverbalized-gushier-alessandra.ngrok-free.dev"; // عدّلها إذا لازم

// ================================
// Small API helper
// ================================
async function apiFetch(path, { method = "GET", body = null, headers = {} } = {}) {
  const token = localStorage.getItem(TOKEN_KEY) || "";

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      Accept: "application/json",
      "ngrok-skip-browser-warning": "true",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : null,
    cache: "no-store",
  });

  // Unauthorized => redirect
  if (res.status === 401 || res.status === 403) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem("supervisorName");
    localStorage.removeItem("selectedProjectId");
    window.location.href = "S_login.html";
    return;
  }

  const ct = res.headers.get("content-type") || "";
  const data = ct.includes("application/json")
    ? await res.json().catch(() => null)
    : await res.text();

  if (!res.ok) {
    const msg =
      (data && data.message) ||
      (typeof data === "string" ? data : "") ||
      `HTTP ${res.status}`;
    throw new Error(msg);
  }

  return data;
}

// ================================
// Logout (global for HTML onclick)
// ================================
window.handleLogout = function handleLogout() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem("supervisorName");
  localStorage.removeItem("selectedProjectId");
  window.location.href = "S_login.html";
};

// ================================
// Mobile Menu
// ================================
const menuToggle = document.getElementById("menuToggle");
const sidebar = document.getElementById("sidebar");
const body = document.body;

if (menuToggle && sidebar) {
  menuToggle.addEventListener("click", function (e) {
    e.stopPropagation();
    sidebar.classList.toggle("active");
    body.classList.toggle("sidebar-open");
    menuToggle.classList.toggle("open");
    menuToggle.setAttribute("aria-expanded", sidebar.classList.contains("active"));
  });

  document.addEventListener("click", function (e) {
    if (!sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
      sidebar.classList.remove("active");
      body.classList.remove("sidebar-open");
      menuToggle.classList.remove("open");
      menuToggle.setAttribute("aria-expanded", "false");
    }
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      sidebar.classList.remove("active");
      body.classList.remove("sidebar-open");
      menuToggle.classList.remove("open");
      menuToggle.setAttribute("aria-expanded", "false");
    }
  });
}

// ================================
// User UI (Supervisor)
// ================================
async function loadCurrentSupervisor() {
  return await apiFetch("/api/users/me/supervisor", { method: "GET" });
}

function applyUserToUI(user) {
  if (!user) return;

  const menuNameEl = document.getElementById("menuUserName");
  if (menuNameEl) menuNameEl.textContent = user.fullName || "";

  const welcomeEl = document.getElementById("welcomeText");
  if (welcomeEl) welcomeEl.textContent = `مرحبًا، ${user.fullName || ""} 👋`;

  const avatar = document.querySelector(".user-avatar");
  if (avatar && user.fullName) avatar.textContent = user.fullName.trim()[0].toUpperCase();
}

async function initUserUI() {
  try {
    const cachedName = localStorage.getItem("supervisorName");
    if (cachedName) applyUserToUI({ fullName: cachedName });

    const user = await loadCurrentSupervisor();
    if (user?.fullName) {
      localStorage.setItem("supervisorName", user.fullName);
      applyUserToUI(user);
    } else {
      window.location.href = "S_login.html";
    }
  } catch (e) {
    console.error("initUserUI error:", e);
  }
}

// ================================
// Page State (from API)
// ================================
let teams = [];                // [{id,name,description,maxMembers,members:[{id,name,role}]}]
let studentsWithoutTeam = [];  // [{id,name,major}]
let selectedTeamId = null;     // for Add / Transfer (from team)
let selectedStudentId = null;  // for Transfer
let selectedFromTeamId = null; // explicit

// ================================
// Fetch Overview from Backend
// ================================
async function loadTeamsOverview() {
  // GET /api/supervisor/teams/overview
  const data = await apiFetch("/api/supervisor/teams/overview", { method: "GET" });

  const apiTeams = Array.isArray(data?.teams) ? data.teams : [];
  const apiNoTeam = Array.isArray(data?.studentsWithoutTeam) ? data.studentsWithoutTeam : [];

  teams = apiTeams.map(t => ({
    id: t.id,
    name: t.name || "—",
    description: t.description || "",
    maxMembers: t.membersLimit ?? 4,
    members: (t.members || []).map(m => ({
      id: m.studentId,
      name: m.name || "—",
      role: m.role || "",
      me: !!m.me,
    })),
  }));

  studentsWithoutTeam = apiNoTeam.map(s => ({
    id: s.id,
    name: s.name || "—",
    major: s.major || "",
  }));

  render();
}

// ================================
// UI Helpers
// ================================
document.addEventListener("change", e => {
  if (e.target.id === "addStudentSelect") {
    const btn = document.getElementById("addConfirmBtn");
    if (btn) btn.disabled = !e.target.value;
  }
});

function toast(msg) {
  const t = document.getElementById("toast");
  if (!t) return alert(msg);
  t.textContent = msg;
  t.style.display = "block";
  setTimeout(() => (t.style.display = "none"), 2500);
}

// ================================
// Render
// ================================
function render() {
  renderTeams();
  renderNoTeam();
}

function renderTeams() {
  const c = document.getElementById("teamsContainer");
  if (!c) return;

  c.innerHTML = teams
    .map(team => `
      <div class="team-card">
        <div class="team-header">
          <div class="team-counter">${team.members.length}/${team.maxMembers} أعضاء</div>
          <h3>${team.name}</h3>
          ${team.description ? `<p class="team-desc">${team.description}</p>` : ""}
        </div>

        <div class="team-body">
          ${team.members
            .map(m => `
              <div class="member-card">
                <div class="member-info">
                  <div class="avatar">${(m.name || "?")[0]}</div>
                  <div>${m.name}</div>
                </div>

                <div class="member-actions">
                  <button class="icon-btn transfer"
                          title="نقل الطالب"
                          onclick="openTransfer(${m.id}, ${team.id})">
                    <i class="bi bi-person-gear"></i>
                  </button>

                  <button class="icon-btn delete"
                          title="إزالة من الفريق"
                          onclick="removeMember(${m.id}, ${team.id})">
                    <i class="bi bi-person-dash"></i>
                  </button>
                </div>
              </div>
            `)
            .join("")}

          <button class="add-btn" onclick="openAdd(${team.id})"
            ${team.members.length >= team.maxMembers ? "disabled" : ""}>
            <i class="bi bi-person-add"></i>
            إضافة طالب للفريق
          </button>
        </div>
      </div>
    `)
    .join("");
}

function renderNoTeam() {
  const c = document.getElementById("noTeamContainer");
  if (!c) return;

  c.innerHTML = studentsWithoutTeam
    .map(s => `
      <div class="no-team-card">
        <div class="member-info">
          <div class="avatar">${(s.name || "?")[0]}</div>
          <div>
            <div>${s.name}</div>
            ${s.major ? `<small>${s.major}</small>` : ""}
          </div>
        </div>
      </div>
    `)
    .join("");

  updateNoTeamCount();
}

function updateNoTeamCount() {
  const countEl = document.getElementById("noTeamCount");
  if (!countEl) return;
  countEl.textContent = `(${studentsWithoutTeam.length})`;
}

// ================================
// Add Member (API)
// ================================
window.openAdd = function openAdd(teamId) {
  selectedTeamId = teamId;

  const team = teams.find(t => t.id === teamId);
  if (!team) return;

  document.getElementById("addModalTitle").textContent =
    `إضافة طالب إلى فريق "${team.name}"`;

  const sel = document.getElementById("addStudentSelect");
  sel.innerHTML = `
    <option value="">اختر طالب...</option>
    ${studentsWithoutTeam.map(s => `<option value="${s.id}">${s.name}</option>`).join("")}
  `;

  document.getElementById("addConfirmBtn").disabled = true;
  document.getElementById("addModal").style.display = "flex";
};

window.closeAddModal = function closeAddModal() {
  document.getElementById("addModal").style.display = "none";
};

window.confirmAdd = async function confirmAdd() {
  try {
    const select = document.getElementById("addStudentSelect");
    const studentId = Number(select.value);
    if (!studentId || !selectedTeamId) return;

    // POST /api/supervisor/teams/{teamId}/members
    await apiFetch(`/api/supervisor/teams/${selectedTeamId}/members`, {
      method: "POST",
      body: { studentId },
    });

    window.closeAddModal();
    toast("تمت إضافة الطالب إلى الفريق ✅");
    await loadTeamsOverview();
  } catch (e) {
    console.error(e);
    toast(`فشل الإضافة: ${e.message || "خطأ"}`);
  }
};

// ================================
// Transfer Member (API)
// ================================
window.openTransfer = function openTransfer(studentId, fromTeamId) {
  selectedStudentId = studentId;
  selectedFromTeamId = fromTeamId;

  const fromTeam = teams.find(t => t.id === fromTeamId);
  const student = fromTeam?.members?.find(m => m.id === studentId);

  const titleEl = document.getElementById("transferModalTitle");
  if (titleEl) {
    const sName = student?.name || "الطالب";
    const tName = fromTeam?.name || "الفريق";
    titleEl.textContent = `نقل "${sName}" من فريق "${tName}"`;
  }

  const sel = document.getElementById("transferTeamSelect");
  const availableTeams = teams.filter(t => t.id !== fromTeamId && t.members.length < t.maxMembers);

  sel.innerHTML = availableTeams.length
    ? availableTeams.map(t => `<option value="${t.id}">${t.name}</option>`).join("")
    : `<option value="">لا يوجد فريق متاح</option>`;

  document.getElementById("transferModal").style.display = "flex";
};

window.closeTransferModal = function closeTransferModal() {
  document.getElementById("transferModal").style.display = "none";
};

window.confirmTransfer = async function confirmTransfer() {
  try {
    const toTeamId = Number(document.getElementById("transferTeamSelect").value);
    if (!toTeamId || !selectedFromTeamId || !selectedStudentId) return;

    // POST /api/supervisor/teams/transfer
    await apiFetch("/api/supervisor/teams/transfer", {
      method: "POST",
      body: {
        studentId: selectedStudentId,
        fromTeamId: selectedFromTeamId,
        toTeamId: toTeamId,
      },
    });

    window.closeTransferModal();
    toast("تم نقل الطالب ✅");
    await loadTeamsOverview();
  } catch (e) {
    console.error(e);
    toast(`فشل النقل: ${e.message || "خطأ"}`);
  }
};

// ================================
// Remove Member (API)
// ================================
window.removeMember = async function removeMember(studentId, teamId) {
  try {
    if (!confirm("متأكد بدك تشيل الطالب من الفريق؟")) return;

    // DELETE /api/supervisor/teams/{teamId}/members/{studentId}
    await apiFetch(`/api/supervisor/teams/${teamId}/members/${studentId}`, {
      method: "DELETE",
    });

    toast("تمت إزالة الطالب من الفريق ✅");
    await loadTeamsOverview();
  } catch (e) {
    console.error(e);
    toast(`فشل الإزالة: ${e.message || "خطأ"}`);
  }
};

// ================================
// Boot
// ================================
document.addEventListener("DOMContentLoaded", async () => {
  await initUserUI();

  try {
    await loadTeamsOverview();
  } catch (e) {
    console.error("loadTeamsOverview error:", e);
    toast("فشل تحميل الفرق/الطلاب. راجع الكونسول.");
  }
});
