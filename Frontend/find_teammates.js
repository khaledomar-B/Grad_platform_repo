
/* ================================
   Logout
================================ */
function handleLogout() {
  window.location.href = "/Auth_Pages/login.html";
}

/* =========================
   Find Teammates - Real Data
========================= */

let totalStudentsAll = 0;
let availableStudentsCount = 0;

// ✅ Combined requests state
let ownerJoinRequests = [];   // طلبات انضمام لفريقي (أنا Owner)
let myInvitations = [];       // دعوات وصلتني من Owners آخرين

// ✅ ALL students cache from overview (source of truth)
let allOverviewStudents = [];

// ✅ rendered list
let students = [];
let currentView = "table"; // table | cards

function headersWithToken(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
    "ngrok-skip-browser-warning": "true",
  };
}

function safeChar(name) {
  return (name && name.trim().length) ? name.trim()[0] : "?";
}

function getFilters() {
  const nameQ = (document.getElementById("filterName")?.value || "").trim();
  const skillsQ = (document.getElementById("filterSkills")?.value || "").trim();
  const availableOnly = document.getElementById("availableOnly")?.checked || false;
  return { nameQ, skillsQ, availableOnly };
}

/* ======================================================
   Team Members (from /api/projects/my)
====================================================== */
async function loadMyTeam() {
  const token = localStorage.getItem("token");
  if (!token) return;

  const res = await fetch(`${API_BASE_URL}/api/projects/my`, {
    headers: headersWithToken(token),
    cache: "no-store",
  });

  if (res.status === 404) {
    renderTeamMembers([]);
    return;
  }

  if (!res.ok) {
    console.error("loadMyTeam failed:", res.status, await res.text());
    renderTeamMembers([]);
    return;
  }

  const data = await res.json();
  const members = Array.isArray(data.members) ? data.members : [];

  members.sort((a, b) => (b.isOwner === true) - (a.isOwner === true));

  renderTeamMembers(members.map(m => ({
    name: m.studentName,
    role: m.isOwner ? "قائد الفريق" : (m.role || "عضو"),
  })));
}

function renderTeamMembers(members) {
  const countEl = document.getElementById("teamMembersCount");
  if (countEl) countEl.textContent = members.length;

  const box = document.getElementById("teamMembersList");
  if (!box) return;

  if (!members.length) {
    box.innerHTML = `<div style="color:#6b7280;font-size:14px;">لا يوجد أعضاء فريق حالياً</div>`;
    return;
  }

  box.innerHTML = members.map(m => `
    <div class="member-card">
      <div class="member-info">
        <div class="member-avatar">${safeChar(m.name)}</div>
        <div class="member-text">
          <div class="member-name">${m.name}</div>
          <div class="member-role">${m.role}</div>
        </div>
      </div>
      <span class="member-status">في الفريق</span>
    </div>
  `).join("");
}

/* ======================================================
   Students Overview (SOURCE OF TRUTH)
   MUST return:
   { totalStudents, availableStudentsCount, students: [{ studentId, name, email, major, skills, available }] }
====================================================== */
async function loadStudentsOverview() {
  const token = localStorage.getItem("token");
  if (!token) return;

  const res = await fetch(`${API_BASE_URL}/api/students/teammates/overview`, {
    headers: headersWithToken(token),
    cache: "no-store",
  });

  if (!res.ok) {
    console.error("overview failed:", res.status, await res.text());
    totalStudentsAll = 0;
    availableStudentsCount = 0;
    allOverviewStudents = [];
    return;
  }

  const data = await res.json();

  totalStudentsAll = Number(data.totalStudents ?? 0);
  availableStudentsCount = Number(data.availableStudentsCount ?? 0);

  const list = Array.isArray(data.students) ? data.students : [];



  allOverviewStudents = list.map(s => ({
    id: s.studentId,
    name: s.name || "—",
    studentIdText: s.email || "—",
    major: s.major ?? "—",
    skills: Array.isArray(s.skills) ? s.skills : [],
    available: !!s.available,
  }));
}

/* =========================
   Apply filters (LOCAL) - correct logic
   - totalStudents is ALWAYS 22 from overview
   - checkbox affects ONLY when checked
   - skills filter works correctly
========================= */
function applyFiltersAndRender() {
  const { nameQ, skillsQ, availableOnly } = getFilters();

  let filtered = [...allOverviewStudents];

  // ✅ checkbox: only when checked
  if (availableOnly) {
    filtered = filtered.filter(s => s.available === true);
  }

  // ✅ name/email filter
  if (nameQ) {
    const n = nameQ.toLowerCase();
    filtered = filtered.filter(s =>
      (s.name || "").toLowerCase().includes(n) ||
      (s.studentIdText || "").toLowerCase().includes(n)
    );
  }

  // ✅ skills filter
  if (skillsQ) {
    const sk = skillsQ.toLowerCase();
    filtered = filtered.filter(s =>
      (s.skills || []).some(x => (x || "").toLowerCase().includes(sk))
    );
  }

  students = filtered;
  renderStudents();
  updateStudentsStatsOnly();
}

/* =========================
   Students stats ONLY (no requests)
========================= */
function updateStudentsStatsOnly() {
  // إجمالي الطلاب (كل النظام)
  const totalEl = document.getElementById("studentsCount");
  if (totalEl) totalEl.textContent = String(totalStudentsAll);

  // عدد المتاحين (حسب API)
  const availableEl = document.getElementById("availableCount");
  if (availableEl) availableEl.textContent = String(availableStudentsCount);

  // ✅ إذا عندك كرت اسمه totalStudentsCount
  const totalStudentsEl = document.getElementById("totalStudentsCount");
  if (totalStudentsEl) totalStudentsEl.textContent = String(totalStudentsAll);
}

/* =========================
   Requests UI (optional)
   (ما رح يأثر على إجمالي الطلاب)
========================= */
function updateRequestsUI() {
  const totalReq = (ownerJoinRequests?.length || 0) + (myInvitations?.length || 0);

  const badge = document.getElementById("requestsBadge");
  if (badge) badge.textContent = String(totalReq);

  const reqEl = document.getElementById("totalRequestsCount");
  if (reqEl) reqEl.textContent = String(totalReq);
}

/* =========================
   Render Students
========================= */
function renderStudents() {
  if (currentView === "table") renderTable();
  else renderCards();
}

function renderTable() {
  const tbody = document.getElementById("studentsTbody");
  if (!tbody) return;

  if (!students.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#6b7280;">لا يوجد طلاب</td></tr>`;
    return;
  }

  tbody.innerHTML = students.map((s, idx) => `
    <tr>
      <td>${idx + 1}</td>
      <td class="name-cell">
        <button class="avatar" type="button"
  onclick="openStudentProfile(${s.id})"
  title="عرض الملف الشخصي"
  style="border:none;cursor:pointer;">
  ${safeChar(s.name)}
</button>

        ${s.name}
      </td>
      <td>${s.studentIdText || "—"}</td>
      <td class="skills">
        ${(s.skills || []).slice(0, 6).map(sk => `<span>${sk}</span>`).join("") || "—"}
      </td>
      <td>
        <span class="status ${s.available ? "available" : "busy"}">
          ${s.available ? "متاح" : "غير متاح"}
        </span>
      </td>
      <td class="actions">
        <button class="msg-btn" onclick="contactStudent(${s.id})"><i class="bi bi-envelope"></i></button>
        <button class="invite-btn" onclick="inviteStudent(${s.id})" ${s.available ? "" : "disabled"}>
          <i class="bi bi-person-plus"></i> دعوة
        </button>
      </td>
    </tr>
  `).join("");
}

function renderCards() {
  const cardView = document.getElementById("cardView");
  if (!cardView) return;

  if (!students.length) {
    cardView.innerHTML = `<div style="color:#6b7280;">لا يوجد طلاب</div>`;
    return;
  }

  cardView.innerHTML = students.map(s => `
    <div class="student-card">
      <div class="card-header">
        <button class="avatar" type="button"
  onclick="openStudentProfile(${s.id})"
  title="عرض الملف الشخصي"
  style="border:none;cursor:pointer;">
  ${safeChar(s.name)}
</button>

        <div>
          <h4>${s.name}</h4>
          <small>${s.studentIdText || "—"}</small>
        </div>
      </div>

      <div class="card-skills">
        ${(s.skills || []).slice(0, 8).map(sk => `<span>${sk}</span>`).join("") || "—"}
      </div>

      <div class="card-actions">
        <button class="invite-btn" onclick="inviteStudent(${s.id})" ${s.available ? "" : "disabled"}>
          <i class="bi bi-person-plus"></i> دعوة
        </button>
        <button class="msg-btn" onclick="contactStudent(${s.id})">
          <i class="bi bi-envelope"></i> تواصل
        </button>
      </div>
    </div>
  `).join("");
}

/* =========================
   Invite student action (same as your original)
========================= */
async function getMyProjectId() {
  const token = localStorage.getItem("token");
  const res = await fetch(`${API_BASE_URL}/api/projects/my`, {
    headers: headersWithToken(token),
    cache: "no-store",
  });

  if (!res.ok) throw new Error("فشل جلب projectId");
  const data = await res.json();
  return data.projectId;
}

window.inviteStudent = async function (studentId) {
  try {
    const token = localStorage.getItem("token");
    if (!token) return alert("مش مسجل دخول");

    const projectId = await getMyProjectId();

    const res = await fetch(`${API_BASE_URL}/api/projects/${projectId}/members`, {
      method: "POST",
      headers: {
        ...headersWithToken(token),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ studentId }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      alert(data.message || "فشل إرسال الدعوة");
      return;
    }

    alert("✅ تم إرسال دعوة الانضمام");
    await reloadAllRequests(); // optional refresh requests tab
  } catch (e) {
    console.error(e);
    alert("صار خطأ أثناء إرسال الدعوة");
  }
};

window.contactStudent = function (studentId) {
  alert("ميزة الرسائل تحتاج صفحة/endpoint Messages — studentId = " + studentId);
};

/* =========================
   Tabs + View Switch + Filters
========================= */
function setupTabsAndView() {
  window.showTeam = function () {
    document.getElementById("teamTab")?.classList.add("active");
    document.getElementById("requestsTab")?.classList.remove("active");
    document.getElementById("teamContent")?.classList.add("active");
    document.getElementById("requestsContent")?.classList.remove("active");
  };

  window.showRequests = function () {
    document.getElementById("requestsTab")?.classList.add("active");
    document.getElementById("teamTab")?.classList.remove("active");
    document.getElementById("requestsContent")?.classList.add("active");
    document.getElementById("teamContent")?.classList.remove("active");
  };

  const tableView = document.getElementById("tableView");
  const cardView = document.getElementById("cardView");
  const switchBtns = document.querySelectorAll(".switch-btn");

  switchBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      switchBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      if (btn.textContent.includes("بطاقات")) {
        currentView = "cards";
        tableView?.classList.add("hidden");
        cardView?.classList.remove("hidden");
      } else {
        currentView = "table";
        cardView?.classList.add("hidden");
        tableView?.classList.remove("hidden");
      }
      renderStudents();
    });
  });

  const nameInput = document.getElementById("filterName");
  const skillsInput = document.getElementById("filterSkills");
  const availableOnly = document.getElementById("availableOnly");

  nameInput?.addEventListener("input", debounce(() => applyFiltersAndRender(), 250));
  skillsInput?.addEventListener("input", debounce(() => applyFiltersAndRender(), 250));

  // ✅ checkbox only affects when checked (this is exactly what you want)
  availableOnly?.addEventListener("change", () => applyFiltersAndRender());
}

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

/* =========================================================
   Requests Tab - COMBINED:
   1) Invitations to me (student)  -> /api/projects/invitations/my
   2) Join requests to my team(s) (owner) -> /api/teams/join-requests/owner
========================================================= */

async function reloadAllRequests() {
  await Promise.allSettled([
    loadMyInvitations(),
    loadJoinRequestsForOwner(),
  ]);
  renderCombinedRequests();
  updateRequestsUI();
}

/* --- (1) Invitations to me (old endpoints) --- */
async function loadMyInvitations() {
  const token = localStorage.getItem("token");
  if (!token) return;

  const res = await fetch(`${API_BASE_URL}/api/projects/invitations/my`, {
    headers: headersWithToken(token),
    cache: "no-store",
  });

  if (!res.ok) {
    console.error("loadMyInvitations failed:", res.status, await res.text());
    myInvitations = [];
    return;
  }

  const data = await res.json();
  myInvitations = data.invitations || [];
}

window.acceptInvite = async function (projectId) {
  const token = localStorage.getItem("token");
  if (!token) return;

  const res = await fetch(`${API_BASE_URL}/api/projects/${projectId}/members/accept`, {
    method: "PUT",
    headers: headersWithToken(token),
    cache: "no-store",
  });

  if (!res.ok) {
    console.error("acceptInvite failed:", res.status, await res.text());
    alert("فشل قبول الدعوة");
    return;
  }

  alert("✅ تم قبول الدعوة والانضمام للمشروع");
  await loadMyTeam();
  await reloadAllRequests();
};

window.rejectInvite = async function (projectId) {
  const token = localStorage.getItem("token");
  if (!token) return;

  const res = await fetch(`${API_BASE_URL}/api/projects/${projectId}/members/reject`, {
    method: "PUT",
    headers: headersWithToken(token),
    cache: "no-store",
  });

  if (!res.ok) {
    console.error("rejectInvite failed:", res.status, await res.text());
    alert("فشل رفض الدعوة");
    return;
  }

  alert("✅ تم رفض الدعوة");
  await reloadAllRequests();
};

/* --- (2) Join requests to my teams (new endpoints) --- */
async function loadJoinRequestsForOwner() {
  const token = localStorage.getItem("token");
  if (!token) return;

  const res = await fetch(`${API_BASE_URL}/api/teams/join-requests/owner`, {
    headers: headersWithToken(token),
    cache: "no-store",
  });

  if (!res.ok) {
    console.error("loadJoinRequestsForOwner failed:", res.status, await res.text());
    ownerJoinRequests = [];
    return;
  }

  const data = await res.json();
  ownerJoinRequests = data.items || [];
}

window.acceptJoinRequest = async function (teamId, studentId) {
  const token = localStorage.getItem("token");
  if (!token) return;

  const res = await fetch(`${API_BASE_URL}/api/teams/${teamId}/join-requests/${studentId}/accept`, {
    method: "POST",
    headers: headersWithToken(token),
    cache: "no-store",
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    alert(data.message || "فشل قبول طلب الانضمام");
    return;
  }

  alert("✅ تم قبول طلب الانضمام");
  await loadMyTeam();
  await reloadAllRequests();
};

window.rejectJoinRequest = async function (teamId, studentId) {
  const token = localStorage.getItem("token");
  if (!token) return;

  const res = await fetch(`${API_BASE_URL}/api/teams/${teamId}/join-requests/${studentId}/reject`, {
    method: "POST",
    headers: headersWithToken(token),
    cache: "no-store",
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    alert(data.message || "فشل رفض طلب الانضمام");
    return;
  }

  alert("✅ تم رفض طلب الانضمام");
  await reloadAllRequests();
};

/* --- Render combined into SAME list box (#requestsList) --- */
function renderCombinedRequests() {
  const box = document.getElementById("requestsList");
  if (!box) return;

  const joinCount = ownerJoinRequests?.length || 0;
  const invCount = myInvitations?.length || 0;

  if (joinCount === 0 && invCount === 0) {
    box.innerHTML = `<div style="margin-top:12px;color:#6b7280;">لا يوجد طلبات حالياً</div>`;
    return;
  }

  let html = "";

  // Section A: Join requests (Owner)
  if (joinCount > 0) {
    html += `
      <div style="margin-top:12px;font-weight:700;color:#111827;">
        طلبات انضمام لفريقي
        <span style="color:#6b7280;font-weight:500;">(${joinCount})</span>
      </div>
    `;

    html += ownerJoinRequests.map(req => `
      <div class="member-card" style="margin-top:12px;">
        <div class="member-info">
          <div class="member-avatar">${safeChar(req.studentName || "؟")}</div>
          <div class="member-text">
            <div class="member-name">${req.studentName || "—"}</div>
            <div class="member-role">طلب الانضمام إلى: ${req.teamName || "—"}</div>
            <div style="color:#6b7280;font-size:12px;margin-top:4px;">
              ${req.teamDescription ? req.teamDescription : ""}
            </div>
          </div>
        </div>

        <div style="display:flex;gap:8px;align-items:center;">
          <button class="invite-btn" onclick="acceptJoinRequest(${req.teamId}, ${req.studentId})">
            <i class="bi bi-check2-circle"></i> قبول
          </button>
          <button class="msg-btn" onclick="rejectJoinRequest(${req.teamId}, ${req.studentId})" style="padding:10px 12px;">
            <i class="bi bi-x-circle"></i>
          </button>
        </div>
      </div>
    `).join("");
  }

  // Divider
  if (joinCount > 0 && invCount > 0) {
    html += `<hr style="margin:16px 0;border:none;border-top:1px solid #e5e7eb;">`;
  }

  // Section B: Invitations to me (Student)
  if (invCount > 0) {
    html += `
      <div style="margin-top:12px;font-weight:700;color:#111827;">
        دعوات وصلتني
        <span style="color:#6b7280;font-weight:500;">(${invCount})</span>
      </div>
    `;

    html += myInvitations.map(inv => `
      <div class="member-card" style="margin-top:12px;">
        <div class="member-info">
          <div class="member-avatar">${safeChar(inv.fromOwner || inv.projectTitle)}</div>
          <div class="member-text">
            <div class="member-name">${inv.projectTitle || "—"}</div>
            <div class="member-role">دعوة من: ${inv.fromOwner || "—"}</div>
            <div style="color:#6b7280;font-size:12px;margin-top:4px;">
              ${inv.projectDescription ? inv.projectDescription : ""}
            </div>
          </div>
        </div>

        <div style="display:flex;gap:8px;align-items:center;">
          <button class="invite-btn" onclick="acceptInvite(${inv.projectId})">
            <i class="bi bi-check2-circle"></i> قبول
          </button>
          <button class="msg-btn" onclick="rejectInvite(${inv.projectId})" style="padding:10px 12px;">
            <i class="bi bi-x-circle"></i>
          </button>
        </div>
      </div>
    `).join("");
  }

  box.innerHTML = html;
}

function setLinkOrHide(aEl, url) {
  if (!aEl) return;
  const u = (url || "").trim();
  if (!u) {
    aEl.style.display = "none";
    aEl.href = "#";
    return;
  }
  aEl.style.display = "inline-flex";
  aEl.href = u;
}

window.openStudentProfile = async function (studentId) {
  const token = localStorage.getItem("token");
  if (!token) return alert("مش مسجل دخول");

  try {
    const res = await fetch(`${API_BASE_URL}/api/students/${studentId}/profile`, {
      headers: headersWithToken(token),
      cache: "no-store",
    });

    if (!res.ok) {
      console.error("profile fetch failed:", res.status, await res.text());
      alert("تعذر تحميل بروفايل الطالب");
      return;
    }

    const p = await res.json();

    // Fill modal
    document.getElementById("pmAvatar").textContent = safeChar(p.fullName);
    document.getElementById("pmName").textContent = p.fullName || "—";
    document.getElementById("pmMajor").textContent = p.major || "—";
    document.getElementById("pmEmail").textContent = p.email || "—";
    document.getElementById("pmUniversityId").textContent = p.universityId || "—";
    document.getElementById("pmBio").textContent = (p.bio && p.bio.trim()) ? p.bio : "—";

    const skillsBox = document.getElementById("pmSkills");
    const skills = Array.isArray(p.skills) ? p.skills : [];
    skillsBox.innerHTML = skills.length
      ? skills.map(s => `<span class="tag">${s}</span>`).join("")
      : `<span style="color:#6b7280;font-size:13px;">لا يوجد مهارات</span>`;

    setLinkOrHide(document.getElementById("pmGithub"), p.github);
    setLinkOrHide(document.getElementById("pmLinkedin"), p.linkedin);

    // Show
    document.getElementById("profileModal")?.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  } catch (e) {
    console.error(e);
    alert("صار خطأ أثناء تحميل البروفايل");
  }
};

window.closeProfileModal = function () {
  document.getElementById("profileModal")?.classList.add("hidden");
  document.body.style.overflow = "";
};

// إغلاق بالـ ESC
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeProfileModal();
});


/* =========================
   init
========================= */
window.addEventListener("load", async () => {
  setupTabsAndView();

  await loadMyTeam();

  // ✅ load overview once -> totalStudentsAll becomes 22
  await loadStudentsOverview();

  // ✅ show list based on filters (checkbox affects only if checked)
  applyFiltersAndRender();

  // ✅ requests (separate, doesn't affect total students)
  await reloadAllRequests();

  // ✅ final stats
  updateStudentsStatsOnly();
});
