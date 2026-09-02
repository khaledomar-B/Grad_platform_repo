(() => {
  "use strict";

  // ================================
  // Config
  // ================================
  const API_BASE_URL = "https://nonverbalized-gushier-alessandra.ngrok-free.dev";
  const TOKEN_KEY = "token";

  // state
  let projectsData = []; // [{id,name,major}]
  let currentProjectId = null;
  let currentProjectPhases = []; // phases for selected project

  // ================================
  // Helpers
  // ================================
  function authHeaders(extra = {}) {
    const token = localStorage.getItem(TOKEN_KEY) || "";
    const h = { "ngrok-skip-browser-warning": "true", ...extra };
    if (token) h.Authorization = `Bearer ${token}`;
    return h;
  }

  async function apiFetch(path, { method = "GET", body, headers } = {}) {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: authHeaders(headers || {}),
      body,
      cache: "no-store",
    });

    const ct = res.headers.get("content-type") || "";
    const payload = ct.includes("application/json")
      ? await res.json().catch(() => null)
      : await res.text().catch(() => "");

    if (!res.ok) {
      const msg =
        (payload && payload.message) ||
        (typeof payload === "string" ? payload : "") ||
        `HTTP ${res.status}`;
      throw new Error(msg);
    }

    return payload;
  }

  function formatDateForUi(v) {
    if (!v) return "غير محدد";
    const d = new Date(v);
    if (isNaN(d)) return String(v);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function ensurePhaseOrderUnique(phases) {
    return [...phases].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  function getCurrentProject() {
    return projectsData.find((p) => p.id === currentProjectId) || null;
  }

  function getPhaseById(phaseId) {
    return currentProjectPhases.find((p) => p.id === phaseId) || null;
  }

  // ================================
  // DOM Wiring
  // ================================
  document.addEventListener("DOMContentLoaded", () => {
    boot().catch((e) => {
      console.error(e);
      alert("❌ فشل تحميل البيانات. شوف الكونسول.");
    });

    const addForm = document.getElementById("addPhaseForm");
    if (addForm) addForm.addEventListener("submit", handleAddPhase);

    const resetBtn = document.getElementById("resetFormBtn");
    if (resetBtn) resetBtn.addEventListener("click", resetPhaseForm);

    const expandAll = document.getElementById("expandAllBtn");
    if (expandAll)
      expandAll.addEventListener("click", () => toggleAllDeliverablesPanels(true));

    const collapseAll = document.getElementById("collapseAllBtn");
    if (collapseAll)
      collapseAll.addEventListener("click", () => toggleAllDeliverablesPanels(false));

    // مودال التواريخ (إغلاق عند الضغط خارج الصندوق)
    const modal = document.getElementById("datesModal");
    if (modal) {
      modal.addEventListener("click", (e) => {
        if (e.target === modal) closeDatesModal();
      });
    }

    // Esc لإغلاق المودال
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeDatesModal();
    });
  });

  // ================================
  // Boot
  // ================================
  async function boot() {
    await loadProjectsForDropdown();
    if (!projectsData.length) {
      currentProjectId = null;
      renderEmptyState();
      return;
    }

    currentProjectId = projectsData[0].id;
    await loadPhasesForCurrentProject();
    renderCurrentProject();

    const select = document.getElementById("projectSelect");
    if (select) {
      select.innerHTML = projectsData
        .map(
          (p) =>
            `<option value="${p.id}">${p.name}${p.major ? " - " + p.major : ""}</option>`
        )
        .join("");
      select.value = String(currentProjectId);
      select.addEventListener("change", handleProjectChange);
    }
  }

  function renderEmptyState() {
    const container = document.getElementById("phasesContainer");
    if (container) {
      container.innerHTML = `
        <div style="padding:16px;border:1px solid #e5e7eb;border-radius:12px;background:#fff;">
          لا يوجد مشاريع لهذا المشرف.
        </div>
      `;
    }
    const el1 = document.getElementById("summaryPhasesCount");
    const el2 = document.getElementById("summaryActiveCount");
    const el3 = document.getElementById("summaryProgress");
    if (el1) el1.textContent = "0";
    if (el2) el2.textContent = "0";
    if (el3) el3.textContent = "0%";
  }

  // ================================
  // API Calls
  // ================================
  async function loadProjectsForDropdown() {
    const data = await apiFetch(`/api/supervisor/phases/projects`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    projectsData = Array.isArray(data) ? data : [];
  }

  async function loadPhasesForCurrentProject() {
    if (!currentProjectId) {
      currentProjectPhases = [];
      return;
    }

    const data = await apiFetch(
      `/api/supervisor/phases/projects/${currentProjectId}/milestones`,
      { method: "GET", headers: { Accept: "application/json" } }
    );

    const phases = data?.phases || [];
    currentProjectPhases = Array.isArray(phases) ? phases : [];
  }

  async function createPhaseApi(payload) {
    return await apiFetch(
      `/api/supervisor/phases/projects/${currentProjectId}/milestones`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      }
    );
  }

  async function togglePhaseStatusApi(phaseId) {
    return await apiFetch(
      `/api/supervisor/phases/projects/${currentProjectId}/milestones/${phaseId}/toggle-status`,
      { method: "PUT", headers: { Accept: "application/json" } }
    );
  }

  async function deletePhaseApi(phaseId) {
    return await apiFetch(
      `/api/supervisor/phases/projects/${currentProjectId}/milestones/${phaseId}`,
      { method: "DELETE", headers: { Accept: "application/json" } }
    );
  }

  async function addDeliverableApi(phaseId, label) {
    return await apiFetch(`/api/supervisor/phases/milestones/${phaseId}/deliverables`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ label }),
    });
  }

  async function removeDeliverableByIndexApi(phaseId, index) {
    return await apiFetch(
      `/api/supervisor/phases/milestones/${phaseId}/deliverables/by-index?index=${encodeURIComponent(
        index
      )}`,
      { method: "DELETE", headers: { Accept: "application/json" } }
    );
  }

  // ✅ Endpoint تحديد مواعيد المرحلة
  async function setPhaseDatesApi(projectId, milestoneId, payload) {
    // PUT /api/supervisor/projects/{projectId}/milestones/{milestoneId}/set-dates
    return await apiFetch(
      `/api/supervisor/projects/${projectId}/milestones/${milestoneId}/set-dates`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      }
    );
  }

  // ================================
  // Rendering
  // ================================
  async function handleProjectChange(e) {
    currentProjectId = Number(e.target.value);
    resetPhaseForm();
    await loadPhasesForCurrentProject();
    renderCurrentProject();
  }

  function renderCurrentProject() {
    const project = getCurrentProject();
    const container = document.getElementById("phasesContainer");
    if (!container) return;

    container.innerHTML = "";
    if (!project) return;

    const phasesSorted = ensurePhaseOrderUnique(currentProjectPhases);
    phasesSorted.forEach((phase) => {
      const card = renderPhaseCard(phase);
      container.appendChild(card);
    });

    updateSummary(phasesSorted);
  }

  function updateSummary(phases) {
    const total = phases.length;
    const active = phases.filter((p) => p.status === "active").length;
    const completed = phases.filter((p) => p.status === "completed").length;
    const progress = total ? Math.round((completed / total) * 100) : 0;

    const el1 = document.getElementById("summaryPhasesCount");
    const el2 = document.getElementById("summaryActiveCount");
    const el3 = document.getElementById("summaryProgress");

    if (el1) el1.textContent = String(total);
    if (el2) el2.textContent = String(active);
    if (el3) el3.textContent = `${progress}%`;
  }

  function renderPhaseCard(phase) {
    const card = document.createElement("article");
    card.className = "phase-card";
    card.dataset.phaseId = phase.id;

    // Header
    const header = document.createElement("div");
    header.className = "phase-header";

    const titleWrapper = document.createElement("div");
    titleWrapper.className = "phase-title-wrapper";

    const orderCircle = document.createElement("div");
    orderCircle.className = "phase-order-circle";
    orderCircle.textContent = phase.order ?? "";

    const title = document.createElement("h3");
    title.className = "phase-title";
    title.textContent = phase.title ?? "—";

    titleWrapper.appendChild(orderCircle);
    titleWrapper.appendChild(title);

    const statusPill = document.createElement("span");
    statusPill.className = "phase-status-pill";

    if (phase.status === "active") {
      statusPill.classList.add("status-active");
      statusPill.innerHTML = `<i class="fa-solid fa-bolt"></i> نشطة`;
    } else if (phase.status === "completed") {
      statusPill.classList.add("status-completed");
      statusPill.innerHTML = `<i class="fa-solid fa-check-circle"></i> مكتملة`;
    } else {
      statusPill.classList.add("status-locked");
      statusPill.innerHTML = `<i class="fa-solid fa-lock"></i> مقفلة`;
    }

    header.appendChild(titleWrapper);
    header.appendChild(statusPill);

    // Description
    const body = document.createElement("p");
    body.className = "phase-body";
    body.textContent = phase.description || "لا يوجد وصف لهذه المرحلة.";

    // Meta row
    const metaRow = document.createElement("div");
    metaRow.className = "phase-meta-row";

    const deadline = document.createElement("div");
    deadline.className = "phase-deadline";
    deadline.innerHTML = `
      <i class="fa-regular fa-calendar"></i>
      <span>الموعد النهائي:</span>
      <strong>${formatDateForUi(phase.deadline)}</strong>
    `;

    const deliverablesWrap = document.createElement("div");
    deliverablesWrap.className = "phase-deliverables";

    const dels = Array.isArray(phase.deliverables) ? phase.deliverables : [];
    if (dels.length > 0) {
      dels.forEach((d) => {
        const pill = document.createElement("span");
        pill.className = "deliverable-pill";
        pill.textContent = d;
        deliverablesWrap.appendChild(pill);
      });
    } else {
      const empty = document.createElement("span");
      empty.className = "deliverable-pill";
      empty.textContent = "لا توجد مخرجات محددة بعد.";
      deliverablesWrap.appendChild(empty);
    }

    metaRow.appendChild(deadline);
    metaRow.appendChild(deliverablesWrap);

    // Actions
    const actions = document.createElement("div");
    actions.className = "phase-actions";

    const setDatesBtn = document.createElement("button");
    setDatesBtn.className = "btn-soft small";
    setDatesBtn.innerHTML = `<i class="fa-regular fa-calendar"></i> تحديد الموعد`;
    setDatesBtn.addEventListener("click", () => openDatesModal(phase.id));

    const toggleStatusBtn = document.createElement("button");
    toggleStatusBtn.className = "btn-soft small";
    toggleStatusBtn.innerHTML = `<i class="fa-solid fa-lock-open"></i> قفل/فتح`;
    toggleStatusBtn.addEventListener("click", async () => {
      try {
        await togglePhaseStatusApi(phase.id);
        await loadPhasesForCurrentProject();
        renderCurrentProject();
      } catch (e) {
        console.error(e);
        alert("❌ فشل تغيير حالة المرحلة: " + (e.message || ""));
      }
    });

    const deliverablesBtn = document.createElement("button");
    deliverablesBtn.className = "btn-soft small";
    deliverablesBtn.innerHTML = `<i class="fa-solid fa-list-check"></i> إدارة المخرجات`;
    deliverablesBtn.addEventListener("click", () => toggleDeliverablesPanel(phase.id));

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "btn-soft small";
    deleteBtn.innerHTML = `<i class="fa-solid fa-trash"></i> حذف`;
    deleteBtn.addEventListener("click", async () => {
      try {
        if (!confirm("هل أنت متأكد من حذف هذه المرحلة؟")) return;
        await deletePhaseApi(phase.id);
        await loadPhasesForCurrentProject();
        renderCurrentProject();
      } catch (e) {
        console.error(e);
        alert("❌ فشل حذف المرحلة: " + (e.message || ""));
      }
    });

    actions.appendChild(setDatesBtn);
    actions.appendChild(toggleStatusBtn);
    actions.appendChild(deliverablesBtn);
    actions.appendChild(deleteBtn);

    // Deliverables Panel
    const delPanel = document.createElement("div");
    delPanel.className = "deliverables-panel";
    delPanel.id = `deliverables-panel-${phase.id}`;

    const list = document.createElement("div");
    list.className = "deliverables-list";

    if (dels.length > 0) {
      dels.forEach((d, index) => {
        const pill = document.createElement("span");
        pill.className = "deliverable-pill";
        pill.innerHTML = `
          ${d}
          <span class="deliverable-remove-btn" title="حذف" data-index="${index}">
            <i class="fa-solid fa-xmark"></i>
          </span>
        `;
        list.appendChild(pill);
      });
    } else {
      const empty = document.createElement("span");
      empty.className = "deliverables-empty";
      empty.textContent = "لا توجد مخرجات بعد. أضف مخرجات جديدة من الأسفل.";
      list.appendChild(empty);
    }

    const formRow = document.createElement("div");
    formRow.className = "deliverables-form-row";

    const newInp = document.createElement("input");
    newInp.type = "text";
    newInp.placeholder = "اسم المخرج الجديد (مثال: تقرير PDF)";
    newInp.className = "field-input";
    newInp.id = `deliverable-input-${phase.id}`;

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "btn-primary";
    addBtn.style.fontSize = "11px";
    addBtn.innerHTML = `<i class="fa-solid fa-plus"></i> إضافة مخرج`;
    addBtn.addEventListener("click", async () => {
      const val = (newInp.value || "").trim();
      if (!val) return;

      try {
        await addDeliverableApi(phase.id, val);
        newInp.value = "";
        await loadPhasesForCurrentProject();
        renderCurrentProject();
        const p = document.getElementById(`deliverables-panel-${phase.id}`);
        if (p) p.classList.add("visible");
      } catch (e) {
        console.error(e);
        alert("❌ فشل إضافة المخرج: " + (e.message || ""));
      }
    });

    formRow.appendChild(newInp);
    formRow.appendChild(addBtn);

    delPanel.appendChild(list);
    delPanel.appendChild(formRow);

    list.addEventListener("click", async (e) => {
      const removeBtn = e.target.closest(".deliverable-remove-btn");
      if (!removeBtn) return;

      const index = Number(removeBtn.dataset.index);
      if (Number.isNaN(index)) return;

      try {
        await removeDeliverableByIndexApi(phase.id, index);
        await loadPhasesForCurrentProject();
        renderCurrentProject();
        const p = document.getElementById(`deliverables-panel-${phase.id}`);
        if (p) p.classList.add("visible");
      } catch (err) {
        console.error(err);
        alert("❌ فشل حذف المخرج: " + (err.message || ""));
      }
    });

    // Compose
    card.appendChild(header);
    card.appendChild(body);
    card.appendChild(metaRow);
    card.appendChild(actions);
    card.appendChild(delPanel);

    return card;
  }

  // ================================
  // Add Phase
  // ================================
  async function handleAddPhase(e) {
    e.preventDefault();

    if (!currentProjectId) {
      alert("لا يوجد مشروع محدد.");
      return;
    }

    const title = (document.getElementById("phaseTitleInput")?.value || "").trim();
    const deadline = document.getElementById("phaseDeadlineInput")?.value || "";
    const order = Number(document.getElementById("phaseOrderInput")?.value) || 1;
    const description = (document.getElementById("phaseDescriptionInput")?.value || "").trim();

    if (!title) {
      alert("اسم المرحلة مطلوب");
      return;
    }

    const payload = {
      order,
      name: title,
      description,
      deadline: deadline ? new Date(deadline).toISOString() : null,
      status: "active",
    };

    try {
      await createPhaseApi(payload);
      await loadPhasesForCurrentProject();
      renderCurrentProject();
      resetPhaseForm();
    } catch (err) {
      console.error(err);
      alert("❌ فشل إضافة المرحلة: " + (err.message || ""));
    }
  }

  function resetPhaseForm() {
    const f = document.getElementById("addPhaseForm");
    if (f) f.reset();
    const orderInp = document.getElementById("phaseOrderInput");
    if (orderInp) orderInp.value = 1;
  }

  // ================================
  // Deliverables UI toggles
  // ================================
  function toggleDeliverablesPanel(phaseId) {
    const panel = document.getElementById(`deliverables-panel-${phaseId}`);
    if (!panel) return;
    panel.classList.toggle("visible");
  }

  function toggleAllDeliverablesPanels(open) {
    const panels = document.querySelectorAll(".deliverables-panel");
    panels.forEach((panel) => {
      if (open) panel.classList.add("visible");
      else panel.classList.remove("visible");
    });
  }

  // ================================
  // Set Dates Modal
  // ================================
  let selectedPhaseForDates = null;

  // ملاحظة: هاي الدوال لازم تكون Global لأنك بتستخدم onclick بالـ HTML للمودال
  window.openDatesModal = function (phaseId) {
    const phase = getPhaseById(phaseId);
    if (!phase) return;

    selectedPhaseForDates = phaseId;

    const title = document.getElementById("datesModalTitle");
    if (title) title.textContent = `تحديد موعد المرحلة: ${phase.title || "—"}`;

    const startInp = document.getElementById("phaseStartDateInput");
    const endInp = document.getElementById("phaseEndDateInput");

    // إذا الباك برجع startAt/endAt
    if (startInp) startInp.value = phase.startAt ? formatDateForUi(phase.startAt) : "";
    if (endInp) endInp.value = phase.endAt ? formatDateForUi(phase.endAt) : "";

    const modal = document.getElementById("datesModal");
    if (modal) modal.style.display = "flex";
  };

  window.closeDatesModal = function () {
    const modal = document.getElementById("datesModal");
    if (modal) modal.style.display = "none";
    selectedPhaseForDates = null;
  };

  window.savePhaseDates = async function () {
    if (!currentProjectId || !selectedPhaseForDates) return;

    const phase = getPhaseById(selectedPhaseForDates);
    if (!phase) return;

    const startDate = document.getElementById("phaseStartDateInput")?.value || "";
    const endDate = document.getElementById("phaseEndDateInput")?.value || "";

    if (!startDate || !endDate) {
      alert("رجاءً اختر تاريخ البداية والنهاية");
      return;
    }
    if (new Date(endDate) < new Date(startDate)) {
      alert("تاريخ النهاية لازم يكون بعد تاريخ البداية");
      return;
    }

    try {
      // إذا الباك بده supervisorId داخل body (حسب DTO عندك)
      const supervisorId = Number(localStorage.getItem("supervisorId") || 0);

      await setPhaseDatesApi(currentProjectId, phase.id, {
        supervisorId,
        startDate,
        endDate,
      });

      // حدّث local + reload
      await loadPhasesForCurrentProject();
      renderCurrentProject();

      window.closeDatesModal();
      alert("✅ تم حفظ مواعيد المرحلة");
    } catch (e) {
      console.error(e);
      alert("❌ فشل حفظ مواعيد المرحلة: " + (e.message || ""));
    }
  };
})();
