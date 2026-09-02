

/* ================================
   Logout
================================ */
function handleLogout() {
  window.location.href = "/Auth_Pages/login.html";
}
/*وثائق المشروع (عرض فقط من الباك)#####################################*/
const API_BASE_URL = "https://nonverbalized-gushier-alessandra.ngrok-free.dev";

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value ?? "—";
}

function calcDoneStages(milestones) {
  return milestones.filter(m => m.mySubmission != null).length;
}

function calcDeadline(milestones) {
  const ends = milestones
    .map(m => m.endDate)
    .filter(x => x != null)
    .map(x => new Date(x))
    .filter(d => !isNaN(d));

  if (!ends.length) return "—";
  const max = new Date(Math.max(...ends.map(d => d.getTime())));
  return max.toLocaleDateString("ar-JO", { year: "numeric", month: "long", day: "numeric" });
}

async function loadProjectHeaderStats() {
  const token = localStorage.getItem("token");
  if (!token) return;

  const myRes = await fetch(`${API_BASE_URL}/api/projects/my`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "ngrok-skip-browser-warning": "true"
    },
    cache: "no-store"
  });

  if (!myRes.ok) return;
  const my = await myRes.json();

  // team from /my
  await loadTeamFromApi(my);

  // documents (for counts)
  const docsRes = await fetch(`${API_BASE_URL}/api/projects/${my.projectId}/documents`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "ngrok-skip-browser-warning": "true"
    },
    cache: "no-store"
  });
  const docs = docsRes.ok ? await docsRes.json() : null;

  setText("pdTitleAr", my.title ?? "—");
  setText("pdTitleEn", my.projectType ?? "—");
  setText("pdStatus", my.status ?? "—");

  const milestones = Array.isArray(my.milestones) ? my.milestones : [];
  const totalStages = milestones.length;
  const doneStages = calcDoneStages(milestones);

  setText("pdStages", `${doneStages}/${totalStages}`);
  const progressPct = totalStages ? Math.round((doneStages / totalStages) * 100) : 0;
  setText("pdProgress", `${progressPct}%`);

  const members = Array.isArray(my.members) ? my.members : [];
  const uniqueCount = new Set(members.map(m => m.studentId)).size;
  setText("pdTeamCount", String(uniqueCount || 1));

  const filesTotal = docs?.total ?? 0;
  setText("pdFilesCount", String(filesTotal));

  setText("pdDeadline", calcDeadline(milestones));
}

function fileIconFromName(fileName) {
  const ext = (fileName.split(".").pop() || "").toLowerCase();
  if (ext === "pdf") return `<i class="fas fa-file-pdf" style="color:#ff3b30;"></i>`;
  if (["doc", "docx"].includes(ext)) return `<i class="fas fa-file-word" style="color:#0d6efd;"></i>`;
  if (["ppt", "pptx"].includes(ext)) return `<i class="fas fa-file-powerpoint" style="color:#ff8c00;"></i>`;
  if (["png", "jpg", "jpeg"].includes(ext)) return `<i class="fas fa-image" style="color:#a259ff;"></i>`;
  return `<i class="fas fa-file" style="color:#6c757d;"></i>`;
}

function fmtSize(bytes) {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024 * 1024) return "KB " + Math.round(bytes / 1024);
  return "MB " + (bytes / (1024 * 1024)).toFixed(1);
}

function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d)) return "—";
  return d.toLocaleDateString("ar-JO");
}

function sectionBg(sectionKey) {
  const map = {
    proposal: "bg-proposal",
    requirements: "bg-requirements",
    design: "bg-design",
    development: "bg-reports",
    presentations: "bg-presentations",
    other: "bg-other",
    final: "bg-other",
    Final: "bg-other"
  };
  return map[sectionKey] || "bg-other";
}

function clearSections() {
  ["proposal", "requirements", "design", "development", "presentations", "Final", "final", "other"].forEach(k => {
    const el = document.getElementById(`section-${k}`);
    if (el) el.innerHTML = "";
  });
}

function setCounts(counts) {
  const keys = ["proposal", "requirements", "design", "development", "presentations", "Final", "final", "other"];

  let total = 0;
  keys.forEach(k => {
    const c = Number(counts?.[k] ?? counts?.[k?.toLowerCase()] ?? 0);
    total += c;

    const countEl = document.getElementById(`count-${k}`);
    if (countEl) countEl.innerText = String(c);
  });

  const totalEl = document.getElementById("total-documents");
  if (totalEl) totalEl.textContent = `وثائق المشروع (${total})`;
}

function addFileCard(sectionKey, f) {
  const container = document.getElementById(`section-${sectionKey}`);
  if (!container) return;

  const card = document.createElement("div");
  card.className = "file-card " + sectionBg(sectionKey);

  const name = f?.name || "file";
  const date = fmtDate(f?.uploadedAt);
  const size = fmtSize(f?.sizeBytes);

  // ✅ href آمن (ما يكسر السكربت)
  let href = "#";
  try {
    if (f?.url) href = new URL(f.url, API_BASE_URL).toString();
  } catch (e) {
    console.warn("Bad file url:", f?.url);
    href = f?.url || "#";
  }

  card.innerHTML = `
    <div class="file-icon">${fileIconFromName(name)}</div>

    <div class="file-info">
      <div class="file-title">${name}</div>
      <div class="file-meta">
        <span>${date} <i class="fas fa-calendar-alt"></i></span>
        <span>•</span>
        <span>${size}</span>
      </div>
    </div>

    <a class="download-btn" href="${href}" target="_blank" rel="noopener">
      تحميل <i class="fas fa-download"></i>
    </a>
  `;

  container.appendChild(card);
}

async function fetchMyProjectId(token) {
  const res = await fetch(`${API_BASE_URL}/api/projects/my`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "ngrok-skip-browser-warning": "true"
    },
    cache: "no-store"
  });
  if (!res.ok) throw new Error("فشل جلب المشروع /api/projects/my");
  const data = await res.json();
  return data.projectId;
}

async function loadProjectDocumentsView() {
  const token = localStorage.getItem("token");
  if (!token) {
    window.location.href = "Auth_Pages/login.html";
    return;
  }

  const projectId = await fetchMyProjectId(token);

  const res = await fetch(`${API_BASE_URL}/api/projects/${projectId}/documents`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "ngrok-skip-browser-warning": "true"
    },
    cache: "no-store"
  });

  if (!res.ok) {
    console.error("GET documents failed:", res.status, await res.text());
    alert("صار خطأ بجلب وثائق المشروع");
    return;
  }

  const data = await res.json();

  clearSections();
  setCounts(data.counts);

  const sections = data.sections || {};

  // ✅ support Final/final/other
  const keys = ["proposal", "requirements", "design", "development", "presentations", "Final", "final", "other"];

  keys.forEach(k => {
    const files =
      Array.isArray(sections[k]) ? sections[k]
        : Array.isArray(sections[k?.toLowerCase()]) ? sections[k.toLowerCase()]
          : [];

    files.forEach(f => addFileCard(k, f));
  });
}

/* ===== Team Members from /api/projects/my ===== */
let teamMembers = [];

async function loadTeamFromApi(myProjectData) {
  const members = Array.isArray(myProjectData?.members) ? myProjectData.members : [];

  teamMembers = members.map(m => ({
    name: m.studentName,
    role: m.isOwner ? "Owner" : (m.role || "عضو"),
    id: String(m.studentId || ""),
    email: "",
    skills: []
  }));

  renderTeam();
}

function renderTeam() {
  const container = document.getElementById("teamMembers");
  if (!container) return;

  container.innerHTML = "";

  teamMembers.forEach(m => {
    const card = document.createElement("div");
    card.className = "member-card";

    const name = m.name || "—";
    const role = m.role || "—";
    const id = m.id || "";
    const email = m.email || "";
    const skills = Array.isArray(m.skills) ? m.skills : [];

    card.innerHTML = `
      <div class="avatar">${(name.charAt(0) || "?")}</div>
      <div class="member-info">
        <h3>${name}</h3>
        <div class="role">${role}</div>

        <div class="member-meta">
          ${id ? `<span>${id}</span>` : ""}
          ${email ? `<span>${email}</span>` : ""}
        </div>

        ${skills.length ? `
          <div class="skills">
            ${skills.map(s => `<span class="skill">${s}</span>`).join("")}
          </div>
        ` : ``}
      </div>
    `;

    container.appendChild(card);
  });

  const teamCountEl = document.getElementById("teamCount");
  if (teamCountEl) teamCountEl.textContent = `(${teamMembers.length})`;
}

/* =========================
   Technologies (API)
========================= */
const modal = document.getElementById("techModal");
const openBtn = document.getElementById("openTechModal");
const closeBtn = document.getElementById("closeTechModal");
const cancelBtn = document.getElementById("cancelTech");
const addBtn = document.getElementById("addTechBtn");

const techName = document.getElementById("techName");
const techCategory = document.getElementById("techCategory");

let technologies = [];
let __projectId = null;

if (openBtn) openBtn.onclick = () => modal.style.display = "flex";
if (closeBtn) closeBtn.onclick = () => modal.style.display = "none";
if (cancelBtn) cancelBtn.onclick = () => modal.style.display = "none";

function authHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
    "Content-Type": "application/json",
    "ngrok-skip-browser-warning": "true",
  };
}

function toCategoryEnum(v) {
  const x = (v || "").toString().trim().toLowerCase();
  if (x === "ai_ml" || x === "ai/ml" || x === "ai" || x === "ml") return 1;
  if (x === "frontend" || x === "front") return 2;
  if (x === "backend" || x === "back") return 3;
  if (x === "database" || x === "db") return 4;
  if (x === "devops") return 5;
  return 6;
}

function normalizeCategoryForUi(cat) {
  const c = (cat || "").toString().trim().toLowerCase();
  if (c.includes("ai") || c.includes("ml")) return "ai_ml";
  if (c.includes("front")) return "frontend";
  if (c.includes("back")) return "backend";
  if (c.includes("data")) return "database";
  if (c.includes("devops")) return "devops";
  return "other";
}

async function fetchMyProjectId_cached() {
  if (__projectId) return __projectId;

  const token = localStorage.getItem("token");
  if (!token) throw new Error("No token");

  const res = await fetch(`${API_BASE_URL}/api/projects/my`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "ngrok-skip-browser-warning": "true",
    },
    cache: "no-store",
  });

  if (!res.ok) throw new Error("Failed /api/projects/my");
  const data = await res.json();
  __projectId = data.projectId;
  return __projectId;
}

async function loadTechnologiesFromApi() {
  const token = localStorage.getItem("token");
  if (!token) return;

  const projectId = await fetchMyProjectId_cached();

  const res = await fetch(`${API_BASE_URL}/api/projects/${projectId}/technologies`, {
    headers: authHeaders(token),
    cache: "no-store",
  });

  if (!res.ok) {
    console.error("GET technologies failed:", res.status, await res.text());
    return;
  }

  const data = await res.json();

  technologies = (data.techs || []).map(t => ({
    id: t.id,
    name: t.name,
    category: normalizeCategoryForUi(t.category)
  }));

  renderTechnologies();
}

async function addTechnologyToApi(name, categoryUiValue) {
  const token = localStorage.getItem("token");
  if (!token) return;

  const projectId = await fetchMyProjectId_cached();

  const res = await fetch(`${API_BASE_URL}/api/projects/${projectId}/technologies`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      category: toCategoryEnum(categoryUiValue),
      name
    }),
  });

  if (!res.ok) {
    console.error("POST tech failed:", res.status, await res.text());
    alert("فشل إضافة التقنية");
    return;
  }

  await loadTechnologiesFromApi();
}

async function deleteTechnologyFromApi(techId) {
  const token = localStorage.getItem("token");
  if (!token) return;

  const res = await fetch(`${API_BASE_URL}/api/projects/technologies/${techId}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });

  if (!res.ok) {
    console.error("DELETE tech failed:", res.status, await res.text());
    alert("فشل حذف التقنية");
    return;
  }

  await loadTechnologiesFromApi();
}

if (addBtn) {
  addBtn.onclick = async () => {
    const name = (techName.value || "").trim();
    const category = techCategory.value;
    if (!name) return alert("أدخل اسم التقنية");

    await addTechnologyToApi(name, category);

    techName.value = "";
    modal.style.display = "none";
  };
}

function renderTechnologies() {
  document.querySelectorAll(".badges").forEach(b => (b.innerHTML = ""));

  technologies.forEach(t => {
    const box = document.querySelector(`.badges[data-cat="${t.category}"]`);
    if (!box) return;

    const badge = document.createElement("span");
    badge.className = `badge ${t.category}`;
    badge.innerHTML = `${t.name} <i class="fas fa-times"></i>`;
    badge.querySelector("i").onclick = () => deleteTechnologyFromApi(t.id);
    box.appendChild(badge);
  });

  updateTechCounts();
  updateTechTotal();
}

function updateTechCounts() {
  document.querySelectorAll(".tech-col").forEach(col => {
    const c = col.querySelectorAll(".badge").length;
    const el = col.querySelector(".count");
    if (!el) return;
    el.textContent = c;
    el.classList.add("count-animate");
    setTimeout(() => el.classList.remove("count-animate"), 300);
  });
}

function updateTechTotal() {
  const el = document.getElementById("totalTechCount");
  if (!el) return;
  el.textContent = `(${technologies.length})`;
  el.classList.add("count-animate");
  setTimeout(() => el.classList.remove("count-animate"), 300);
}

/* =========================
   Links (API)
========================= */
let currentType = null;
let links = {};
let __linksProjectId = null;

function linksHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
    "Content-Type": "application/json",
    "ngrok-skip-browser-warning": "true",
  };
}

function isValidURL(url) {
  try { new URL(url); return true; } catch { return false; }
}

async function getMyProjectIdForLinks() {
  if (__linksProjectId) return __linksProjectId;

  const token = localStorage.getItem("token");
  const res = await fetch(`${API_BASE_URL}/api/projects/my`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "ngrok-skip-browser-warning": "true",
    },
    cache: "no-store"
  });

  if (!res.ok) throw new Error("Failed /api/projects/my");
  const data = await res.json();
  __linksProjectId = data.projectId;
  return __linksProjectId;
}

async function loadLinksFromApi() {
  const token = localStorage.getItem("token");
  if (!token) return;

  const projectId = await getMyProjectIdForLinks();
  const res = await fetch(`${API_BASE_URL}/api/projects/${projectId}/links`, {
    headers: linksHeaders(token),
    cache: "no-store"
  });

  if (!res.ok) {
    console.error("GET links failed:", res.status, await res.text());
    return;
  }

  const data = await res.json();
  links = data.links || {};
  updateLinksUI();
}

function updateLinksUI() {
  ["demo", "github", "docs", "figma"].forEach(type => {
    const desc = document.getElementById("desc-" + type);
    const btn = document.getElementById("btn-" + type);
    if (!desc || !btn) return;

    if (links[type]) {
      desc.innerText = links[type];
      desc.style.color = "#2563eb";
      btn.style.display = "none";
    } else {
      desc.innerText = "لم يتم إضافة رابط بعد";
      desc.style.color = "#9ca3af";
      btn.style.display = "inline-block";
    }
  });
}

window.handleCardClick = function (type) {
  if (links[type]) window.open(links[type], "_blank");
  else openLinksModal(type);
};

function openLinksModal(type) {
  currentType = type;
  document.getElementById("linksModalTitle").innerText =
    links[type] ? "تعديل الرابط" : "إضافة رابط";
  document.getElementById("linksInput").value = links[type] || "";
  document.getElementById("links-modal-overlay").style.display = "flex";
}

window.openLinksModal = openLinksModal;
window.closeLinksModal = function () {
  document.getElementById("links-modal-overlay").style.display = "none";
};

function toEnumType(type) {
  if (type === "demo") return 1;
  if (type === "github") return 2;
  if (type === "docs") return 3;
  return 4;
}

window.saveLink = async function () {
  const url = document.getElementById("linksInput").value.trim();
  if (!isValidURL(url)) {
    alert("الرجاء إدخال رابط صحيح");
    return;
  }

  const token = localStorage.getItem("token");
  const projectId = await getMyProjectIdForLinks();

  const res = await fetch(`${API_BASE_URL}/api/projects/${projectId}/links`, {
    method: "POST",
    headers: linksHeaders(token),
    body: JSON.stringify({ type: toEnumType(currentType), url })
  });

  if (!res.ok) {
    console.error("POST link failed:", res.status, await res.text());
    alert("فشل حفظ الرابط");
    return;
  }

  await loadLinksFromApi();
  window.closeLinksModal();
};

/* ✅ init واحد فقط + try/catch */
window.addEventListener("load", async () => {
  try { await loadProjectHeaderStats(); } catch (e) { console.error("header", e); }
  try { await loadProjectDocumentsView(); } catch (e) { console.error("docs", e); }
  try { await loadTechnologiesFromApi(); } catch (e) { console.error("tech", e); }
  try { await loadLinksFromApi(); } catch (e) { console.error("links", e); }
});
/*نهاية وثائق المشروع#####################################*/
