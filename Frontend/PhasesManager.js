// بيانات تجريبية لمشاريع + مراحل + مخرجات
const projectsData = [
    {
        id: 1,
        name: "نظام إدارة المكتبة الذكي",
        major: "علوم الحاسوب",
        phases: [
            {
                id: 101,
                order: 1,
                title: "تقديم المقترح",
                description: "تسليم فكرة المشروع، الأهداف، والمشكلة المقترحة.",
                deadline: "2024-10-05",
                status: "completed",
                deliverables: ["نموذج المقترح PDF", "عرض تقديمي قصير"],
            },
            {
                id: 102,
                order: 2,
                title: "تحليل المتطلبات",
                description: "تجميع وتحليل متطلبات النظام الوظيفية وغير الوظيفية.",
                deadline: "2024-10-20",
                status: "active",
                deliverables: ["وثيقة المتطلبات", "Use Case Diagram"],
            },
            {
                id: 103,
                order: 3,
                title: "التصميم والتطوير",
                description: "تصميم قاعدة البيانات والواجهات وبدء التطوير.",
                deadline: "2024-11-10",
                status: "locked",
                deliverables: ["ERD", "Class Diagram"],
            },
        ],
    },
    {
        id: 2,
        name: "منصة التجارة الإلكترونية الذكية",
        major: "نظم المعلومات الحاسوبية",
        phases: [
            {
                id: 201,
                order: 1,
                title: "تصميم النظام",
                description: "تصميم البنية المعمارية للنظام وواجهات المستخدم.",
                deadline: "2024-10-12",
                status: "active",
                deliverables: ["UI Mockups", "System Architecture Diagram"],
            },
        ],
    },
];

let currentProjectId = projectsData[0]?.id || null;

// ========= تهيئة الصفحة ========= //
document.addEventListener("DOMContentLoaded", () => {
    populateProjectSelect();
    renderCurrentProject();

    document
        .getElementById("projectSelect")
        .addEventListener("change", handleProjectChange);

    document
        .getElementById("addPhaseForm")
        .addEventListener("submit", handleAddPhase);

    document
        .getElementById("resetFormBtn")
        .addEventListener("click", resetPhaseForm);

    document
        .getElementById("expandAllBtn")
        .addEventListener("click", () => toggleAllDeliverablesPanels(true));

    document
        .getElementById("collapseAllBtn")
        .addEventListener("click", () => toggleAllDeliverablesPanels(false));
});

// ========= الدوال المساعدة ========= //

function getCurrentProject() {
    return projectsData.find((p) => p.id === currentProjectId);
}

function populateProjectSelect() {
    const select = document.getElementById("projectSelect");
    select.innerHTML = "";

    projectsData.forEach((project) => {
        const opt = document.createElement("option");
        opt.value = project.id;
        opt.textContent = project.name;
        select.appendChild(opt);
    });

    if (currentProjectId) {
        select.value = currentProjectId;
    }
}

function handleProjectChange(e) {
    currentProjectId = Number(e.target.value);
    renderCurrentProject();
    resetPhaseForm();
}

function renderCurrentProject() {
    const project = getCurrentProject();
    const container = document.getElementById("phasesContainer");
    container.innerHTML = "";

    if (!project) return;

    // ترتيب المراحل حسب order
    project.phases.sort((a, b) => a.order - b.order);

    project.phases.forEach((phase) => {
        const card = renderPhaseCard(phase);
        container.appendChild(card);
    });

    updateSummary(project);
}

function updateSummary(project) {
    const total = project.phases.length;
    const active = project.phases.filter((p) => p.status === "active").length;
    const completed = project.phases.filter((p) => p.status === "completed").length;
    const progress = total ? Math.round((completed / total) * 100) : 0;

    document.getElementById("summaryPhasesCount").textContent = total;
    document.getElementById("summaryActiveCount").textContent = active;
    document.getElementById("summaryProgress").textContent = `${progress}%`;
}

function renderPhaseCard(phase) {
    const card = document.createElement("article");
    card.className = "phase-card";
    card.dataset.phaseId = phase.id;

    // ===== هيدر الكرت ===== //
    const header = document.createElement("div");
    header.className = "phase-header";

    const titleWrapper = document.createElement("div");
    titleWrapper.className = "phase-title-wrapper";

    const orderCircle = document.createElement("div");
    orderCircle.className = "phase-order-circle";
    orderCircle.textContent = phase.order;

    const title = document.createElement("h3");
    title.className = "phase-title";
    title.textContent = phase.title;

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

    // ===== الوصف ===== //
    const body = document.createElement("p");
    body.className = "phase-body";
    body.textContent = phase.description || "لا يوجد وصف لهذه المرحلة.";

    // ===== صف الميتا ===== //
    const metaRow = document.createElement("div");
    metaRow.className = "phase-meta-row";

    const deadline = document.createElement("div");
    deadline.className = "phase-deadline";
    deadline.innerHTML = `
        <i class="fa-regular fa-calendar"></i>
        <span>الموعد النهائي:</span>
        <strong>${phase.deadline || "غير محدد"}</strong>
    `;

    const deliverablesWrap = document.createElement("div");
    deliverablesWrap.className = "phase-deliverables";

    if (phase.deliverables && phase.deliverables.length > 0) {
        phase.deliverables.forEach((d) => {
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

    // ===== أزرار الكرت ===== //
    const actions = document.createElement("div");
    actions.className = "phase-actions";

    const toggleStatusBtn = document.createElement("button");
    toggleStatusBtn.className = "btn-soft small";
    toggleStatusBtn.innerHTML = `<i class="fa-solid fa-lock-open"></i> قفل/فتح`;
    toggleStatusBtn.addEventListener("click", () => togglePhaseStatus(phase.id));

    const deliverablesBtn = document.createElement("button");
    deliverablesBtn.className = "btn-soft small";
    deliverablesBtn.innerHTML = `<i class="fa-solid fa-list-check"></i> إدارة المخرجات`;
    deliverablesBtn.addEventListener("click", () =>
        toggleDeliverablesPanel(phase.id)
    );

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "btn-soft small";
    deleteBtn.innerHTML = `<i class="fa-solid fa-trash"></i> حذف`;
    deleteBtn.addEventListener("click", () => deletePhase(phase.id));

    actions.appendChild(toggleStatusBtn);
    actions.appendChild(deliverablesBtn);
    actions.appendChild(deleteBtn);

    // ===== لوحة المخرجات ===== //
    const delPanel = document.createElement("div");
    delPanel.className = "deliverables-panel";
    delPanel.id = `deliverables-panel-${phase.id}`;

    const list = document.createElement("div");
    list.className = "deliverables-list";

    if (phase.deliverables && phase.deliverables.length > 0) {
        phase.deliverables.forEach((d, index) => {
            const pill = document.createElement("span");
            pill.className = "deliverable-pill";
            pill.innerHTML = `
                ${d}
                <span class="deliverable-remove-btn" title="حذف"
                    data-index="${index}">
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

    addBtn.addEventListener("click", () =>
        addDeliverableToPhase(phase.id, newInp.value)
    );

    formRow.appendChild(newInp);
    formRow.appendChild(addBtn);

    delPanel.appendChild(list);
    delPanel.appendChild(formRow);

    // زر حذف مخرج واحد
    list.addEventListener("click", (e) => {
        const removeBtn = e.target.closest(".deliverable-remove-btn");
        if (!removeBtn) return;
        const index = Number(removeBtn.dataset.index);
        removeDeliverableFromPhase(phase.id, index);
    });

    // تجميع الكرت
    card.appendChild(header);
    card.appendChild(body);
    card.appendChild(metaRow);
    card.appendChild(actions);
    card.appendChild(delPanel);

    return card;
}

// ========= إضافة مرحلة ========= //

function handleAddPhase(e) {
    e.preventDefault();
    const project = getCurrentProject();
    if (!project) return;

    const title = document.getElementById("phaseTitleInput").value.trim();
    const deadline = document.getElementById("phaseDeadlineInput").value;
    const order = Number(document.getElementById("phaseOrderInput").value) || 1;
    const description = document
        .getElementById("phaseDescriptionInput")
        .value.trim();

    if (!title) return;

    const newPhase = {
        id: Date.now(),
        order,
        title,
        description,
        deadline,
        status: "active",
        deliverables: [],
    };

    project.phases.push(newPhase);
    renderCurrentProject();
    resetPhaseForm();
}

function resetPhaseForm() {
    document.getElementById("addPhaseForm").reset();
    document.getElementById("phaseOrderInput").value = 1;
}

// ========= تغيير حالة المرحلة ========= //

function togglePhaseStatus(phaseId) {
    const project = getCurrentProject();
    if (!project) return;

    const phase = project.phases.find((p) => p.id === phaseId);
    if (!phase) return;

    if (phase.status === "locked") {
        phase.status = "active";
    } else if (phase.status === "active") {
        phase.status = "completed";
    } else {
        phase.status = "locked";
    }

    renderCurrentProject();
}

// ========= حذف مرحلة ========= //

function deletePhase(phaseId) {
    const project = getCurrentProject();
    if (!project) return;

    if (!confirm("هل أنت متأكد من حذف هذه المرحلة؟")) return;

    project.phases = project.phases.filter((p) => p.id !== phaseId);
    renderCurrentProject();
}

// ========= إدارة لوح المخرجات ========= //

function toggleDeliverablesPanel(phaseId) {
    const panel = document.getElementById(`deliverables-panel-${phaseId}`);
    if (!panel) return;
    panel.classList.toggle("visible");
}

function toggleAllDeliverablesPanels(open) {
    const panels = document.querySelectorAll(".deliverables-panel");
    panels.forEach((panel) => {
        if (open) {
            panel.classList.add("visible");
        } else {
            panel.classList.remove("visible");
        }
    });
}

function addDeliverableToPhase(phaseId, label) {
    const project = getCurrentProject();
    if (!project) return;

    const phase = project.phases.find((p) => p.id === phaseId);
    if (!phase) return;

    const trimmed = (label || "").trim();
    if (!trimmed) return;

    phase.deliverables.push(trimmed);
    renderCurrentProject();
}

function removeDeliverableFromPhase(phaseId, index) {
    const project = getCurrentProject();
    if (!project) return;

    const phase = project.phases.find((p) => p.id === phaseId);
    if (!phase) return;

    phase.deliverables.splice(index, 1);
    renderCurrentProject();
}
