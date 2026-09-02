/* S_Dashboard.js
   ربط صفحة Supervisor Dashboard بالـ API الحقيقي
   ✅ تعديل: إضافة تقارير/ملاحظات "لكل مشاريع الدكتور" (POST broadcast بدون projectId)
   ✅ إبقاء العرض (GET) حسب المشروع المختار (كما كان)
*/

(() => {
  // ✅ عدّل حسب بيئتك
  const API_BASE_URL = "https://nonverbalized-gushier-alessandra.ngrok-free.dev";
  const TOKEN_KEY = "token";

  // ✅ NEW ENDPOINTS (مطابقة للباك عندك)
  // POST broadcast
  const SUP_WEEKLY_REPORTS_BROADCAST_POST = "/api/supervisor/projects/weekly-reports/broadcast";
  const SUP_COMMENTS_BROADCAST_POST = "/api/supervisor/projects/comments/broadcast";

  // GET per project (زي ما هو)
  const SUP_WEEKLY_REPORTS_GET = (projectId) => `/api/supervisor/projects/${projectId}/weekly-reports`;
  const SUP_COMMENTS_GET = (projectId) => `/api/supervisor/projects/${projectId}/comments`;

  // ================================
  // Helpers: Auth + Fetch
  // ================================
  function getToken() {
    return localStorage.getItem(TOKEN_KEY) || "";
  }

  function authHeaders(extra = {}) {
    const token = getToken();
    const h = {
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
      window.location.href = "S_login.html";
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
  // Settings Modal Logic (guards)
  // ================================
  const openBtn = document.getElementById("openSettings");
  const closeBtn = document.getElementById("closeSettings");
  const modal = document.getElementById("settingsModal");
  const overlay = document.getElementById("settingsOverlay");

  if (openBtn && closeBtn && modal && overlay) {
    openBtn.onclick = () => {
      modal.style.display = "block";
      overlay.style.display = "block";
    };
    closeBtn.onclick = () => {
      modal.style.display = "none";
      overlay.style.display = "none";
    };

    const maxMembersSelect = document.getElementById("maxMembers");
    const membersHint = document.getElementById("membersHint");
    const saveBtn = document.querySelector(".save-btn");
    const settingsNote = document.getElementById("settingsNote");

    function updateHint() {
      if (!maxMembersSelect || !membersHint) return;
      const value = maxMembersSelect.value;
      membersHint.textContent = `سيتمكن الطلاب من إضافة ما يصل إلى ${value} أعضاء في فريقه`;
    }

    if (maxMembersSelect) {
      maxMembersSelect.addEventListener("change", updateHint);
      updateHint();
    }

    if (saveBtn && settingsNote && maxMembersSelect) {
      saveBtn.addEventListener("click", () => {
        const value = maxMembersSelect.value;

        settingsNote.textContent = `✅ تم حفظ الإعدادات: الحد الأقصى لأعضاء الفريق هو ${value}`;
        settingsNote.classList.remove("hidden");
        settingsNote.classList.add("show");

        modal.style.display = "none";
        overlay.style.display = "none";

        setTimeout(() => {
          settingsNote.classList.remove("show");
          setTimeout(() => settingsNote.classList.add("hidden"), 300);
        }, 3000);
      });
    }
  }

  // ================================
  // Small UI helpers
  // ================================
  const actionNote = document.getElementById("actionNote");
  function showNote(message, type = "success") {
    if (!actionNote) return;
    actionNote.textContent = message;
    actionNote.className = `action-note show ${type}`;
    setTimeout(() => {
      actionNote.classList.remove("show");
      setTimeout(() => actionNote.classList.add("hidden"), 300);
    }, 3000);
  }

  function animateCountersFromData() {
    const counters = document.querySelectorAll(".counter");
    counters.forEach((counter) => {
      const target = Number(counter.dataset.target || "0");
      const speed = 200;
      const updateCounter = () => {
        const current = Number(counter.innerText || "0");
        const increment = Math.ceil(target / speed) || 1;
        if (current < target) {
          counter.innerText = String(current + increment);
          setTimeout(updateCounter, 15);
        } else {
          counter.innerText = String(target);
        }
      };
      counter.innerText = "0";
      updateCounter();
    });
  }

  // ================================
  // Project details navigation
  // ================================
  window.openProjectDetails = function openProjectDetails(projectId, mode) {
    window.location.href = `S_project_details_button.html?id=${projectId}&mode=${mode}`;
  };

  function detailsButtonHtml(projectId, mode = "review", extraClass = "") {
    return `
      <button class="details-btn ${extraClass}" onclick="openProjectDetails(${projectId}, '${mode}')">
        <i class="bi bi-eye"></i> عرض التفاصيل
      </button>
    `;
  }

  // ================================
  // Section A: Dashboard Stats
  // ================================
  async function loadDashboardStats() {
    const data = await apiFetch(`/api/supervisor/projects/dashboard-stats`, { method: "GET" });
    if (!data) return;

    const counters = document.querySelectorAll(".counter");
    if (counters.length >= 3) {
      counters[0].dataset.target = String(data.total ?? 0);     // إجمالي المشاريع
      counters[1].dataset.target = String(data.pending ?? 0);   // قيد المراجعة
      counters[2].dataset.target = String(data.approved ?? 0);  // موافق عليه
      animateCountersFromData();
    }
  }

  // ================================
  // Section B: Supervisor Requests
  // ================================
  const reviewList = document.getElementById("reviewList");
  const projectsCount = document.getElementById("projectsCount");

  async function loadSupervisorRequests() {
    const requests = await apiFetch(`/api/supervisor/projects/supervisor/requests`, { method: "GET" });
    if (!requests) return;

    const arr = Array.isArray(requests) ? requests : [];
    if (projectsCount) projectsCount.textContent = `${arr.length} مشروع`;

    if (!reviewList) return;
    reviewList.innerHTML = "";

    if (arr.length === 0) {
      reviewList.innerHTML = `
        <div class="review-card" style="justify-content:center;padding:14px;">
          لا يوجد طلبات إشراف حالياً
        </div>
      `;
      return;
    }

    arr.forEach((r, index) => {
      const card = document.createElement("div");
      card.className = "review-card";
      card.innerHTML = `
        <div class="review-content">
          <div class="project-index">${index + 1}</div>
          <div class="project-info">
            <h4>${r.projectTitle || "مشروع"}</h4>
            <span class="status-badge">طلب إشراف</span>
          </div>
        </div>

        <div class="review-actions">
          <button class="reject-btn" data-action="reject" data-id="${r.requestId}">
            <i class="bi bi-x-circle"></i> رفض
          </button>

          <button class="approve-btn" data-action="accept" data-id="${r.requestId}">
            <i class="bi bi-check-circle"></i> موافقة
          </button>

          ${detailsButtonHtml(r.projectId, "review")}
        </div>
      `;
      reviewList.appendChild(card);
    });

    reviewList.querySelectorAll("button[data-action]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const action = btn.dataset.action;
        const id = btn.dataset.id;
        if (!id) return;

        btn.disabled = true;
        try {
          if (action === "accept") {
            await apiFetch(`/api/supervisor/projects/supervisor/requests/${id}/accept`, { method: "POST" });
            showNote("✅ تم قبول طلب الإشراف", "success");
          } else {
            await apiFetch(`/api/supervisor/projects/supervisor/requests/${id}/reject`, { method: "POST" });
            showNote("❌ تم رفض طلب الإشراف", "danger");
          }

          await loadSupervisorRequests();
          await loadActiveProjects();
          await loadDashboardStats();
        } catch (err) {
          console.error(err);
          showNote(`⚠️ خطأ: ${err.message || "حدث خطأ"}`, "danger");
        } finally {
          btn.disabled = false;
        }
      });
    });
  }

  // ================================
  // Section C: Active projects
  // ================================
  const activeContainer = document.getElementById("activeProjectsContainer");
  const activeCountBadge = document.getElementById("activeCount");

  function getSelectedProjectId() {
    const url = new URL(window.location.href);
    const q = url.searchParams.get("projectId");
    if (q) return Number(q);
    const saved = localStorage.getItem("selectedProjectId");
    if (saved) return Number(saved);
    return null;
  }

  function setSelectedProjectId(id) {
    if (!id) return;
    localStorage.setItem("selectedProjectId", String(id));
  }

  async function loadActiveProjects() {
    const projects = await apiFetch(`/api/supervisor/projects/active`, { method: "GET" });
    if (!projects) return;

    const arr = Array.isArray(projects) ? projects : [];
    if (activeCountBadge) activeCountBadge.textContent = `${arr.length} مشاريع`;

    if (!activeContainer) return;
    activeContainer.innerHTML = "";

    if (arr.length === 0) {
      activeContainer.innerHTML = `
        <div class="active-card" style="justify-content:center;padding:14px;">
          لا يوجد مشاريع نشطة حالياً
        </div>
      `;
      renderWeeklyReports([]);
      renderComments([]);
      return;
    }

    let selectedId = getSelectedProjectId();
    if (!selectedId) {
      selectedId = arr[0]?.projectId;
      if (selectedId) setSelectedProjectId(selectedId);
    }

    arr.forEach((p) => {
      const isSelected = Number(p.projectId) === Number(selectedId);

      const card = document.createElement("div");
      card.className = "active-card";
      card.style.cursor = "pointer";
      card.dataset.projectId = String(p.projectId);

      card.innerHTML = `
        <div class="project-index">${p.projectId}</div>
        <div class="project-info">
          <h4>${p.title || "مشروع"}</h4>
          <span class="status-approved">${isSelected ? "مختار" : "موافق عليه"}</span>
        </div>
        <div class="project-actions">
          ${detailsButtonHtml(p.projectId, "active")}
        </div>
      `;

      card.addEventListener("click", async (e) => {
        if (e.target.closest("button")) return;

        setSelectedProjectId(p.projectId);
        showNote(`📌 تم اختيار المشروع: ${p.title}`, "success");

        await loadWeeklyReports();
        await loadSupervisorComments();
        await loadActiveProjects();
      });

      activeContainer.appendChild(card);
    });
  }

  // ================================
  // Upload (Weekly Reports) - UI only
  // ================================
  const uploadBox = document.getElementById("uploadBox");
  const fileInput = document.getElementById("fileInput");
  const filesList = document.getElementById("filesList");
  let uploadedFiles = [];

  function renderFiles() {
    if (!filesList) return;
    filesList.innerHTML = "";

    uploadedFiles.forEach((file, index) => {
      const size =
        file.size > 1024 * 1024
          ? (file.size / (1024 * 1024)).toFixed(2) + " MB"
          : (file.size / 1024).toFixed(1) + " KB";

      filesList.innerHTML += `
        <div class="file-item">
          <div class="file-content">
            <i class="bi bi-file-earmark-text file-icon"></i>
            <div class="file-text">
              <span class="file-name">${file.name}</span>
              <small class="file-size">${size}</small>
            </div>
          </div>

          <div class="file-remove" data-remove="${index}">
            <i class="bi bi-x"></i>
          </div>
        </div>
      `;
    });

    filesList.querySelectorAll("[data-remove]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.dataset.remove);
        uploadedFiles.splice(idx, 1);
        renderFiles();
      });
    });
  }

  if (uploadBox && fileInput) {
    uploadBox.addEventListener("click", () => fileInput.click());

    fileInput.addEventListener("change", () => {
      uploadedFiles = [...uploadedFiles, ...Array.from(fileInput.files || [])];
      renderFiles();
    });

    uploadBox.addEventListener("dragover", (e) => {
      e.preventDefault();
      uploadBox.classList.add("dragover");
    });

    uploadBox.addEventListener("dragleave", () => {
      uploadBox.classList.remove("dragover");
    });

    uploadBox.addEventListener("drop", (e) => {
      e.preventDefault();
      uploadBox.classList.remove("dragover");
      const droppedFiles = Array.from(e.dataTransfer.files || []);
      uploadedFiles = [...uploadedFiles, ...droppedFiles];
      renderFiles();
    });
  }

  // ================================
  // Weekly Reports (API)
  // ================================
  const publishBtn = document.querySelector(".submit-btn");
  const reportsList = document.getElementById("weeklyReportsList");
  const weeklyReportsCard = document.getElementById("weeklyReportsCard");

  const weekInput = document.querySelector('input[type="number"]');
  const titleInput = document.querySelector('input[type="text"]');
  const contentInput = document.querySelector("textarea");

  function formatArDate(d) {
    try {
      return new Date(d).toLocaleString("ar-EG");
    } catch {
      return "";
    }
  }

  function renderWeeklyReports(items) {
    if (!reportsList || !weeklyReportsCard) return;

    reportsList.innerHTML = "";
    const arr = Array.isArray(items) ? items : [];

    if (arr.length === 0) {
      weeklyReportsCard.style.display = "none";
      return;
    }

    weeklyReportsCard.style.display = "block";

    arr.forEach((r) => {
      const card = document.createElement("div");
      card.className = "weekly-report-card";
      card.innerHTML = `
        <div class="weekly-report-header">
          <span class="week-badge">الأسبوع ${r.weekNumber ?? "-"}</span>
          <span class="weekly-report-title">${r.title || "تقرير أسبوعي"}</span>
        </div>

        <p class="weekly-report-text">${r.content || ""}</p>

        <div class="weekly-report-date">${formatArDate(r.createdAt)}</div>
      `;
      reportsList.appendChild(card);
    });
  }

  async function loadWeeklyReports() {
    const projectId = getSelectedProjectId();
    if (!projectId) {
      renderWeeklyReports([]);
      return;
    }
    const data = await apiFetch(SUP_WEEKLY_REPORTS_GET(projectId), { method: "GET" });
    if (!data) return;
    renderWeeklyReports(data);
  }

  async function addWeeklyReport() {
    const weekNumber = Number(weekInput?.value || 0);
    const title = (titleInput?.value || "").trim();
    const content = (contentInput?.value || "").trim();

    if (!weekNumber || !content) {
      alert("يرجى تعبئة رقم الأسبوع ومحتوى التقرير");
      return;
    }

    // ✅ POST broadcast الصحيح (بدون projectId)
    await apiFetch(SUP_WEEKLY_REPORTS_BROADCAST_POST, {
      method: "POST",
      body: JSON.stringify({ weekNumber, title, content }),
    });

    if (weekInput) weekInput.value = "";
    if (titleInput) titleInput.value = "";
    if (contentInput) contentInput.value = "";
    uploadedFiles = [];
    if (filesList) filesList.innerHTML = "";

    await loadWeeklyReports();
    showNote("✅ تم نشر التقرير الأسبوعي على جميع المشاريع النشطة", "success");
  }

  if (publishBtn) {
    publishBtn.addEventListener("click", async () => {
      publishBtn.disabled = true;
      try {
        await addWeeklyReport();
      } catch (e) {
        console.error(e);
        showNote(`⚠️ خطأ: ${e.message || "حدث خطأ"}`, "danger");
      } finally {
        publishBtn.disabled = false;
      }
    });
  }

  // ================================
  // Supervisor Comments (API)
  // ================================
  const publishCommentBtn = document.getElementById("publishCommentBtn");
  const supervisorCommentsCard = document.getElementById("supervisorCommentsCard");
  const supervisorCommentsList = document.getElementById("supervisorCommentsList");

  const commentTitleInput = document.getElementById("commentTitle");
  const commentContentInput = document.getElementById("commentContent");

  function renderComments(items) {
    if (!supervisorCommentsList || !supervisorCommentsCard) return;

    supervisorCommentsList.innerHTML = "";
    const arr = Array.isArray(items) ? items : [];

    if (arr.length === 0) {
      supervisorCommentsCard.style.display = "none";
      return;
    }

    supervisorCommentsCard.style.display = "block";

    arr.forEach((c) => {
      const card = document.createElement("div");
      card.className = "weekly-report-card supervisor-note";
      card.innerHTML = `
        <div class="weekly-report-header">
          <span class="weekly-report-title">${c.title || "ملاحظة"}</span>
        </div>

        <p class="weekly-report-text">${c.content || ""}</p>

        <div class="weekly-report-date">${formatArDate(c.createdAt)}</div>
      `;
      supervisorCommentsList.appendChild(card);
    });
  }

  async function loadSupervisorComments() {
    const projectId = getSelectedProjectId();
    if (!projectId) {
      renderComments([]);
      return;
    }

    const data = await apiFetch(SUP_COMMENTS_GET(projectId), { method: "GET" });
    if (!data) return;
    renderComments(data);
  }

  async function addSupervisorComment() {
    const title = (commentTitleInput?.value || "").trim();
    const content = (commentContentInput?.value || "").trim();

    if (!title || !content) {
      alert("يرجى تعبئة عنوان ومحتوى الملاحظة");
      return;
    }

    // ✅ POST broadcast الصحيح (بدون projectId)
    await apiFetch(SUP_COMMENTS_BROADCAST_POST, {
      method: "POST",
      body: JSON.stringify({ title, content }),
    });

    if (commentTitleInput) commentTitleInput.value = "";
    if (commentContentInput) commentContentInput.value = "";

    await loadSupervisorComments();
    showNote("✅ تم نشر الملاحظة على جميع المشاريع النشطة", "success");
  }

  if (publishCommentBtn) {
    publishCommentBtn.addEventListener("click", async () => {
      publishCommentBtn.disabled = true;
      try {
        await addSupervisorComment();
      } catch (e) {
        console.error(e);
        showNote(`⚠️ خطأ: ${e.message || "حدث خطأ"}`, "danger");
      } finally {
        publishCommentBtn.disabled = false;
      }
    });
  }

  // ================================
  // Init
  // ================================
  async function init() {
    const token = getToken();
    if (!token) {
      window.location.href = "S_login.html";
      return;
    }

    await initUserUI();

    try {
      await loadDashboardStats();
      await loadSupervisorRequests();
      await loadActiveProjects();
      await loadWeeklyReports();
      await loadSupervisorComments();
    } catch (e) {
      console.error(e);
      showNote(`⚠️ خطأ: ${e.message || "حدث خطأ"}`, "danger");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
