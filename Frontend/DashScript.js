
/* ================================
   Logout
================================ */
function handleLogout() {
    window.location.href = "/Auth_Pages/login.html";
}


const API_BASE_URL = "https://nonverbalized-gushier-alessandra.ngrok-free.dev";
let isSimilarityHigh = false;
/* ================================
   Supervisors Dropdown
================================ */
async function loadApprovedSupervisors() {
    try {
        const token = localStorage.getItem("token");
        if (!token) return;

        const response = await fetch(`${API_BASE_URL}/api/supervisor/projects/approved-supervisors`, {
            headers: {
                Authorization: `Bearer ${token}`,
                "Accept": "application/json",
                "ngrok-skip-browser-warning": "true"
            },
            cache: "no-store"
        });

        if (!response.ok) {
            console.error("Failed to load supervisors:", response.status);
            return;
        }

        const list = await response.json(); // [{id,name,college,department}, ...]

        const fillSelect = (selectId) => {
            const sel = document.getElementById(selectId);
            if (!sel) return;

            const oldVal = sel.value;

            sel.innerHTML = `
                <option value="">-- اختر المشرف --</option>
                ${list.map(s => `
                    <option value="${s.id}">
                        ${s.name}${s.department ? " - " + s.department : ""}${s.college ? " (" + s.college + ")" : ""}
                    </option>
                `).join("")}
            `;

            // محاولة الاحتفاظ بالاختيار السابق إن وجد
            if (oldVal) sel.value = oldVal;
        };

        fillSelect("supervisorSelectIndividual");
        fillSelect("supervisorSelectTeam");

    } catch (error) {
        console.error("loadApprovedSupervisors error:", error);
    }
}

const submitProjectBtn = document.getElementById("submitProjectBtn");



/* ================================
   Mobile Menu
================================ */
const menuToggle = document.getElementById("menuToggle");
const sidebar = document.getElementById("sidebar");
const body = document.body;

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

/* ================================
   Create Project Modal
================================ */
const createProjectBtn = document.getElementById("openCreateProjectModal");
const createProjectModal = document.getElementById("createProjectModal");
const modalOverlay = document.getElementById("modalOverlay");
const closeModalBtn = document.getElementById("closeModalBtn");
const cancelBtn = document.getElementById("cancelBtn");
const teamCancelBtn = document.getElementById("teamCancelBtn");


if (createProjectBtn) {
    createProjectBtn.addEventListener("click", () => {
        createProjectModal.classList.add("active");
        modalOverlay.classList.add("active");
        document.body.style.overflow = "hidden";
        loadApprovedSupervisors();
    });
}

function resetAiBox(form) {
    if (!form) return;

    const beforeEl = form.querySelector("#aiBeforeCheck");
    const afterEl = form.querySelector("#aiAfterCheck");
    const loadEl = form.querySelector("#aiLoading");

    if (beforeEl) beforeEl.style.display = "block";
    if (afterEl) afterEl.style.display = "none";
    if (loadEl) loadEl.style.display = "none";

    const percentEl = form.querySelector("#similarityPercentage");
    const progressEl = form.querySelector("#aiProgress");
    const statusEl = form.querySelector("#aiStatus");
    const descEl = form.querySelector("#aiDescription");

    if (percentEl) percentEl.innerText = "0%";
    if (progressEl) progressEl.style.width = "0%";
    if (statusEl) statusEl.innerHTML = "";
    if (descEl) descEl.innerHTML = "";
}

function resetProjectForms() {
    const typeSel = document.getElementById("projectTypeSelection");
    const individualForm = document.getElementById("individualProjectForm");
    const teamForm = document.getElementById("teamProjectForm");

    // رجّع شاشة اختيار النوع
    if (typeSel) typeSel.style.display = "block";
    if (individualForm) individualForm.style.display = "none";
    if (teamForm) teamForm.style.display = "none";

    // فضّي حقول الفردي
    if (individualForm) {
        const t = individualForm.querySelector("input.form-input");
        const d = individualForm.querySelector("textarea.form-textarea");
        if (t) t.value = "";
        if (d) d.value = "";
        resetAiBox(individualForm);
    }

    // فضّي حقول الجماعي
    if (teamForm) {
        const t = teamForm.querySelector("input.form-input");
        const d = teamForm.querySelector("textarea.form-textarea");
        if (t) t.value = "";
        if (d) d.value = "";
        resetAiBox(teamForm);
    }

    // صفّر حالة التشابه + عطّل زر إنشاء المشروع
    isSimilarityHigh = false;
    const submitBtn = document.getElementById("submitProjectBtn");
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.style.opacity = "0.6";
        submitBtn.style.cursor = "not-allowed";
    }

    // (اختياري) تصفير الأعضاء بالجماعي
    selectedMembers = [];
    displaySelectedMembers();
}

function closeModal() {
    createProjectModal.classList.remove("active");
    modalOverlay.classList.remove("active");
    document.body.style.overflow = "auto";

    // ✅ أهم سطر
    resetProjectForms();
}

if (closeModalBtn) closeModalBtn.addEventListener("click", closeModal);
if (cancelBtn) cancelBtn.addEventListener("click", closeModal);
if (modalOverlay) modalOverlay.addEventListener("click", closeModal);

/* ================================
   Project Type
================================ */
function handleIndividualProject() {
    document.getElementById("projectTypeSelection").style.display = "none";
    document.getElementById("individualProjectForm").style.display = "block";
    loadApprovedSupervisors();
}


function handleTeamProject() {
    document.getElementById("projectTypeSelection").style.display = "none";
    document.getElementById("teamProjectForm").style.display = "block";
    loadApprovedSupervisors();

    fetchMembers(""); // ✅ جيب الطلاب المتاحين مباشرة
}


// ================================
// Create Project
// ================================
async function createProject(projectType) {
    try {
        const token = localStorage.getItem("token");

        // ✅ بديل يعتمد على الفورم المفتوح (فردي/جماعي)
        const individualForm = document.getElementById("individualProjectForm");
        const teamForm = document.getElementById("teamProjectForm");
        const isIndividualVisible = individualForm && window.getComputedStyle(individualForm).display !== "none";
        const activeForm = isIndividualVisible ? individualForm : teamForm;

        const title = activeForm.querySelector("input.form-input")?.value?.trim() || "";
        const description = activeForm.querySelector("textarea.form-textarea")?.value?.trim() || "";
        // ✅ SupervisorId from dropdown
        const supervisorSelect = activeForm.querySelector("#supervisorSelectIndividual, #supervisorSelectTeam");
        const supervisorId = parseInt(supervisorSelect?.value || "0", 10);

        if (!supervisorId) {
            alert("⚠️ يرجى اختيار المشرف قبل إنشاء المشروع");
            return;
        }



        const response = await fetch(`${API_BASE_URL}/api/projects`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
                "Accept": "application/json",
                "ngrok-skip-browser-warning": "true"
            },
            cache: "no-store"
            ,
            body: JSON.stringify({
                title,
                description,
                projectType,
                supervisorId
            })
        });

        if (!response.ok) {
            const raw = await response.text(); // ✅ مهم
            let msg = "فشل إنشاء المشروع";

            try {
                const j = JSON.parse(raw);
                msg = j.message || j.error || j.detail || msg;
            } catch {
                // لو مش JSON (HTML / نص)
                msg = raw?.slice(0, 200) || msg;
            }

            console.error("Create project failed:", response.status, raw);
            alert(msg);
            return;
        }

        const result = await response.json();
        console.log("Project created:", result);

        // إذا المشروع جماعي → نضيف الأعضاء
        if (projectType === "Group" && selectedMembers.length > 0) {
            await addMembersToProject(result.projectId);
        }

        closeModal();
        loadMyProject();

    } catch (error) {
        console.error("Create project error:", error);
    }
}
// ================================
// Add Members to Project
// ================================
async function addMembersToProject(projectId) {
    const token = localStorage.getItem("token");

    for (const member of selectedMembers) {
        try {
            await fetch(
                `${API_BASE_URL}/api/projects/${projectId}/members`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                        "Accept": "application/json",
                        "ngrok-skip-browser-warning": "true"
                    }
                    ,
                    body: JSON.stringify({
                        studentId: member.id
                    })
                }
            );
        } catch (error) {
            console.error("Add member error:", member, error);
        }
    }
}


/* ================================
   Members State
================================ */
let allMembers = [];
let selectedMembers = [];

/* ================================
   Fetch Members (REAL API)
================================ */
async function fetchMembers(query = "") {
    try {
        const token = localStorage.getItem("token");

        const response = await fetch(
            `${API_BASE_URL}/api/students/search?query=${encodeURIComponent(query)}`,
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Accept": "application/json",
                    "ngrok-skip-browser-warning": "true"
                },
                cache: "no-store"
            }
        );

        if (!response.ok) {
            throw new Error("Failed to fetch members");
        }

        const data = await response.json();
        console.log("students search raw response:", data);

        allMembers = data.map(s => ({
            id: s.studentId,                // ✅ من الـ API
            name: s.name,                   // ✅ من الـ API
            studentId: s.email,             // بنعرض الإيميل تحت الاسم
            major: s.major ?? "—",          // لو ما بترجع major رح يطلع "—"
            avatar: (s.name || "?").charAt(0)
        }));


        displayMembers(allMembers);
    } catch (error) {
        console.error("Fetch members error:", error);
    }
}

/* ================================
   Display Members
================================ */
function displayMembers(members) {
    const membersList = document.getElementById("membersList");
    if (!membersList) return;

    if (members.length === 0) {
        membersList.innerHTML =
            '<div class="no-members-message">لا توجد طلاب متاحين</div>';
        return;
    }

    membersList.innerHTML = members
        .map(
            member => `
        <label class="member-item ${selectedMembers.find(m => m.id === member.id) ? "selected" : ""
                }">
            <input type="checkbox"
                   class="member-checkbox"
                   data-member-id="${member.id}"
                   ${selectedMembers.find(m => m.id === member.id)
                    ? "checked"
                    : ""
                }>
            <div class="member-avatar">${member.avatar}</div>
            <div class="member-info">
                <div class="member-name">${member.name}</div>
                <div class="member-id">${member.studentId}</div>
                <div class="member-major">${member.major}</div>
            </div>
        </label>
    `
        )
        .join("");

    document.querySelectorAll(".member-checkbox").forEach(cb => {
        cb.addEventListener("change", handleMemberCheckbox);
    });
}

function handleMemberCheckbox(e) {
    const memberId = parseInt(e.target.dataset.memberId);
    const member = allMembers.find(m => m.id === memberId);

    if (e.target.checked) {
        if (!selectedMembers.find(m => m.id === memberId)) {
            selectedMembers.push(member);
        }
    } else {
        selectedMembers = selectedMembers.filter(m => m.id !== memberId);
    }

    e.target.closest(".member-item").classList.toggle("selected");
}

/* ================================
   Selected Members Badges
================================ */
function displaySelectedMembers() {
    const container = document.getElementById("membersContainer");
    if (!container) return;

    if (selectedMembers.length === 0) {
        container.innerHTML = "";
        return;
    }

    container.innerHTML = selectedMembers
        .map(
            m => `
        <div class="member-badge">
            <span class="member-badge-name">${m.name}</span>
            <span class="remove-member" onclick="removeMember(${m.id})">×</span>
        </div>
    `
        )
        .join("");
}

function removeMember(memberId) {
    selectedMembers = selectedMembers.filter(m => m.id !== memberId);
    displaySelectedMembers();

    const checkbox = document.querySelector(
        `input[data-member-id="${memberId}"]`
    );
    if (checkbox) {
        checkbox.checked = false;
        checkbox.closest(".member-item").classList.remove("selected");
    }
}

/* ================================
   Members Modal
================================ */
const addMembersBtn = document.getElementById("addMembersBtn");
const membersModal = document.getElementById("membersModal");
const closeMembersModalBtn = document.getElementById("closeMembersModalBtn");
const cancelMembersBtn = document.getElementById("cancelMembersBtn");
const confirmMembersBtn = document.getElementById("confirmMembersBtn");
const membersModalOverlay = document.getElementById("membersModalOverlay");
/* ================================
   Members Search (FIX ENTER ISSUE)
================================ */
const membersSearchInput = document.getElementById("membersSearch");

if (membersSearchInput) {

    // 🔴 منع Enter من عمل submit للفورم
    membersSearchInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            e.stopPropagation();
        }
    });

    // 🔍 البحث أثناء الكتابة
    membersSearchInput.addEventListener("input", (e) => {
        const query = e.target.value.trim();

        if (query.length === 0) {
            fetchMembers(""); // ✅ رجّع كل الطلاب المتاحين
            return;
        }

        fetchMembers(query);
    });
}


if (addMembersBtn) {
    addMembersBtn.addEventListener("click", e => {
        e.preventDefault();
        membersModal.classList.add("active");
        membersModalOverlay.classList.add("active");
        document.body.style.overflow = "hidden";

        fetchMembers(""); // ✅ اعرض طلاب مباشرة
    });
}


function closeMembersModal() {
    membersModal.classList.remove("active");
    membersModalOverlay.classList.remove("active");
    document.body.style.overflow = "auto";
}

if (closeMembersModalBtn)
    closeMembersModalBtn.addEventListener("click", closeMembersModal);
if (cancelMembersBtn)
    cancelMembersBtn.addEventListener("click", closeMembersModal);
if (membersModalOverlay)
    membersModalOverlay.addEventListener("click", closeMembersModal);

if (confirmMembersBtn) {
    confirmMembersBtn.addEventListener("click", () => {
        displaySelectedMembers();
        closeMembersModal();
    });
}

// ================================
// Load user name (Menu + Dashboard)
// ================================
document.addEventListener("DOMContentLoaded", () => {
    const name = localStorage.getItem("studentName");
    const token = localStorage.getItem("token");

    // 🔒 لو ما في تسجيل دخول
    if (!name || !token) {
        window.location.href = "Auth_Pages/login.html";
        return;
    }

    // 👤 اسم المستخدم في المنيو
    const menuName = document.getElementById("menuUserName");
    if (menuName) {
        menuName.innerText = name;
    }

    // 🟢 أول حرف في الدائرة
    const avatar = document.querySelector(".user-avatar");
    if (avatar && name) {
        avatar.innerText = name.charAt(0).toUpperCase();
    }


    // 👋 رسالة الترحيب في الداشبورد
    const welcome = document.getElementById("welcomeText");
    if (welcome) {
        welcome.innerText = `👋 مرحبًا، ${name}`;
    }

    if (submitProjectBtn) {
        submitProjectBtn.disabled = true;
        submitProjectBtn.style.opacity = "0.6";
        submitProjectBtn.style.cursor = "not-allowed";
    }
    // ✅ إذا عنده مشروع مسبقًا، ودّيه تلقائيًا حسب status
    const currentPage = location.pathname.split("/").pop().toLowerCase();
    if (currentPage === "dashboard.html") {
        loadMyProject();
    }

});

// ================================
// Load My Project (Dashboard)
// ================================
async function loadMyProject() {
    try {
        const token = localStorage.getItem("token");

        const response = await fetch(`${API_BASE_URL}/api/projects/my`, {
            headers: {
                Authorization: `Bearer ${token}`,
                "Accept": "application/json",
                "ngrok-skip-browser-warning": "true"
            },
            cache: "no-store"
        });


        if (response.status === 404) {
            console.log("No project yet");
            return;
        }

        if (!response.ok) {
            throw new Error("Failed to load project");
        }

        const project = await response.json();
        console.log("My Project:", project);
        const status = (project.status || "").toLowerCase();

        // ✅ Pending → صفحة انتظار داخل created_project
        if (status === "pending") {
            window.location.href = "created_project.html?mode=pending";
            return;
        }

        // ✅ Active (بعد موافقة المشرف) → صفحة المشروع الكاملة
        if (status === "active") {
            window.location.href = "created_project.html";
            return;
        }

        // (اختياري) Rejected
        if (status === "rejected") {
            alert("تم رفض المشروع من قبل المشرف.");
            return;
        }

        // fallback
        window.location.href = "created_project.html";


        // لاحقًا: نعرضه بالـ UI
    } catch (error) {
        console.error("Load project error:", error);
    }
}
// ================================
// AI Similarity Check (works for individual + team)
// ================================
document.addEventListener("click", async (e) => {
    const btn = e.target.closest("#aiSearchBtn");
    if (!btn) return; // مش زر الفحص
    console.log("Clicked similarity button ✅");
    e.preventDefault();

    // نحدد الفورم اللي ظاهر حالياً
    const individualForm = document.getElementById("individualProjectForm");
    const teamForm = document.getElementById("teamProjectForm");

    const individualVisible =
        individualForm && window.getComputedStyle(individualForm).display !== "none";

    const activeForm = individualVisible ? individualForm : teamForm;

    console.log("Active form is:", activeForm?.id);

    const titleInput = activeForm?.querySelector("input.form-input");
    const descInput = activeForm?.querySelector("textarea.form-textarea");

    const title = titleInput?.value.trim() || "";
    const summary = descInput?.value.trim() || "";

    const cleanText = (s) =>
        (s || "")
            .replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, "")
            .replace(/[\u200B-\u200D\uFEFF]/g, "")
            .replace(/\u00A0/g, " ")
            .replace(/\s+/g, " ")
            .trim();

    const titleClean = cleanText(title);
    const summaryClean = cleanText(summary);

    console.log("titleClean:", titleClean);
    console.log("summaryClean:", summaryClean);

    if (!titleClean && !summaryClean) {
        alert("يرجى إدخال عنوان أو وصف للمشروع");
        return;
    }

    // UI states
    // UI states (safe)
    const beforeEl = activeForm?.querySelector("#aiBeforeCheck");
    const afterEl = activeForm?.querySelector("#aiAfterCheck");
    const loadEl = activeForm?.querySelector("#aiLoading");


    if (beforeEl) beforeEl.style.display = "none";
    if (afterEl) afterEl.style.display = "none";
    if (loadEl) loadEl.style.display = "block";


    try {
        const response = await fetch(`${API_BASE_URL}/api/Ai/similarity-check`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: titleClean, summary: summaryClean, text: "" })
        });

        const data = await response.json();
        console.log("Similarity API response:", data);

        if (!response.ok) {
            throw new Error(data?.error || data?.detail || "فشل الفحص");
        }

        const percent =
            data?.SimilarityPercentage ??
            data?.similarity_percentage ??
            data?.similarityPercentage ??
            0;

        const isDuplicate =
            data?.IsPossibleDuplicate ??
            data?.is_possible_duplicate ??
            data?.isPossibleDuplicate ??
            false;

        const matchedTitle =
            data?.MatchedProjectTitle ??
            data?.matched_project_title ??
            data?.matchedProjectTitle ??
            "";

        isSimilarityHigh = isDuplicate;

        const submitBtn = document.getElementById("submitProjectBtn");
        if (submitBtn) {
            submitBtn.disabled = isSimilarityHigh;
            submitBtn.style.opacity = isSimilarityHigh ? "0.6" : "1";
            submitBtn.style.cursor = isSimilarityHigh ? "not-allowed" : "pointer";
        }

        // UI update (safe)
        if (loadEl) loadEl.style.display = "none";
        if (afterEl) afterEl.style.display = "block";
        // 🔥 تغيير اللون حسب التشابه
        if (afterEl) {
            afterEl.classList.remove("ai-success", "ai-danger");

            if (isDuplicate) {
                afterEl.classList.add("ai-danger"); // أحمر
            } else {
                afterEl.classList.add("ai-success"); // أخضر
            }
        }

        const percentEl = activeForm?.querySelector("#similarityPercentage");
        const progressEl = activeForm?.querySelector("#aiProgress");
        const statusEl = activeForm?.querySelector("#aiStatus");
        const descEl = activeForm?.querySelector("#aiDescription");


        if (percentEl && progressEl) {
            percentEl.innerText = percent + "%";
            progressEl.style.width = percent + "%";

            // تنظيف أي ألوان قديمة
            percentEl.classList.remove("low", "high");
            progressEl.classList.remove("low", "high");
            progressEl.parentElement.classList.remove("low", "high");

            if (isDuplicate) {
                // 🔴 تشابه مرتفع
                percentEl.classList.add("high");
                progressEl.classList.add("high");
                progressEl.parentElement.classList.add("high");
            } else {
                // 🟢 تشابه منخفض
                percentEl.classList.add("low");
                progressEl.classList.add("low");
                progressEl.parentElement.classList.add("low");
            }
        }

        const statusText = isDuplicate
            ? "تشابه مرتفع - المشروع قد يكون مكرر"
            : "تشابه منخفض - المشروع أصلي";

        if (statusEl) {
            statusEl.innerHTML = `
        <span class="ai-status-text">${statusText}</span>
        <i class="fas ${isDuplicate ? "fa-exclamation-circle" : "fa-check-circle"}"></i>
    `;
        }

        if (descEl) {
            descEl.innerHTML = `
        <span>الوصف:</span>
        <p>
            ${isDuplicate
                    ? "المشروع مشابه لمشروع سابق بعنوان: " + matchedTitle
                    : "المشروع يبدو أصليًا ولا يوجد تشابه عالي"
                }
        </p>
    `;
        }

        // fallback لو الجماعي ما فيه صندوق AI
        if (!percentEl || !statusEl) {
            alert(`نتيجة الفحص: ${percent}% - ${statusText}`);
        }


    } catch (err) {
        console.error("Similarity error:", err);
        if (loadEl) loadEl.style.display = "none";
        if (beforeEl) beforeEl.style.display = "block";
        alert(err.message);
    }
});


function finishCreatingProject() {
    // 1️⃣ فحص التشابه
    if (isSimilarityHigh) {
        alert("❌ لا يمكن إنشاء المشروع لأن نسبة التشابه عالية");
        return;
    }

    // 2️⃣ تحديد الفورم الفعّال
    const individualForm = document.getElementById("individualProjectForm");
    const teamForm = document.getElementById("teamProjectForm");

    const isTeamVisible =
        teamForm && window.getComputedStyle(teamForm).display !== "none";

    const activeForm = isTeamVisible ? teamForm : individualForm;

    // 3️⃣ جلب الحقول
    const titleInput = activeForm.querySelector("input.form-input");
    const descInput = activeForm.querySelector("textarea.form-textarea");

    const title = (titleInput?.value || "").trim();
    const description = (descInput?.value || "").trim();

    // 4️⃣ VALIDATION (هذا هو المهم)
    if (!title || !description) {
        alert("⚠️ يرجى إدخال عنوان ووصف المشروع قبل الإنشاء");
        return;
    }

    // 5️⃣ إنشاء المشروع
    createProject(isTeamVisible ? "Group" : "Individual");
}

const teamForm = document.getElementById("teamProjectForm");
const isTeamVisible = teamForm && window.getComputedStyle(teamForm).display !== "none";








/* ================= Project Category Card (NEW - via Backend) ================= */

document.addEventListener("click", async (e) => {
    const btn = e.target.closest('[data-action="suggest-category"]');
    if (!btn) return;

    e.preventDefault();

    // ✅ الفورم الحالي (فردي/جماعي) حسب الزر اللي انضغط
    const form = btn.closest("form") || btn.closest("#individualProjectForm") || btn.closest("#teamProjectForm");
    if (!form) return;

    const title = form.querySelector("input.form-input")?.value?.trim() || "";
    const description = form.querySelector("textarea.form-textarea")?.value?.trim() || "";

    if (!title || !description) {
        alert("يرجى إدخال عنوان ووصف المشروع أولاً");
        return;
    }

    // عناصر UI داخل نفس الفورم
    const selectEl = form.querySelector(".category-select");
    const resultBox = form.querySelector(".ai-category-result");
    const labelEl = form.querySelector(".ai-cat-label");
    const confEl = form.querySelector(".ai-cat-confidence");

    const token = localStorage.getItem("token");

    // UI loading
    btn.disabled = true;
    const oldHtml = btn.innerHTML;
    btn.innerHTML = "⏳ جاري التحليل...";

    try {
        // ✅ Frontend -> Backend (زي report)
        const res = await fetch(`${API_BASE_URL}/api/ai/predict-category`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
                "Accept": "application/json",
                "ngrok-skip-browser-warning": "true"
            },
            cache: "no-store",
            body: JSON.stringify({ title, description, keywords: "" })
        });

        const raw = await res.text();
        let data;
        try { data = JSON.parse(raw); } catch { data = {}; }

        if (!res.ok) {
            throw new Error(data?.message || data?.error || raw || "AI error");
        }

        const label = data?.label ?? "";
        const confidence =
            data?.confidenceLevel ??
            data?.confidence_level ??
            data?.confidence ??
            "";

        if (selectEl && label) selectEl.value = label;

        if (labelEl) labelEl.textContent = label || "-";
        if (confEl) confEl.textContent = confidence || "-";
        if (resultBox) resultBox.style.display = "block";

    } catch (err) {
        console.error("Category AI error:", err);
        alert(err.message || "فشل اقتراح الفئة، حاول لاحقًا");
    } finally {
        btn.disabled = false;
        btn.innerHTML = oldHtml;
    }
});

