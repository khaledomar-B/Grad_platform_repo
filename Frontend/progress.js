(() => {
  "use strict";

  /* ================================
     Logout
  ================================ */
  function handleLogout() {
    window.location.href = "/Auth_Pages/login.html";
  }
  window.handleLogout = handleLogout;

  // ✅ داخل IIFE عشان ما يتعارض مع DashScript.js
  const API_BASE_URL = "https://nonverbalized-gushier-alessandra.ngrok-free.dev";
  const TOKEN_KEY = "token";

  // ✅ state بدل localStorage
  let phasesState = {};          // { phase1: {status,...}, ... }
  const TOTAL_PHASES = 7;        // صفحة UI عندك 7 كروت
  const selectedFiles = {};      // مثال: { 1: [File, File], 2: [File] }

  // ✅ نخزن projectId الحقيقي من /api/projects/my (مهم ل Phase1 AI)
  let CURRENT_PROJECT_ID = null;

  /* ================================
     Helpers
  ================================ */
  function authHeaders(extra = {}) {
    const token = localStorage.getItem(TOKEN_KEY) || "";
    const h = {
      "ngrok-skip-browser-warning": "true",
      ...extra,
    };
    if (token) h.Authorization = `Bearer ${token}`;
    return h;
  }

  function formatDT(v) {
    if (!v) return "—";
    const d = new Date(v);
    if (isNaN(d)) return "—";
    return d.toLocaleString("ar-JO", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function getPhases() {
    return phasesState;
  }

  function savePhases(phases) {
    phasesState = phases;
  }

  function applyPendingModeInProgressPage(isPending) {
    const stagesContainer = document.getElementById("phasesContent");

    let banner = document.getElementById("pendingBanner");
    if (!banner) {
      banner = document.createElement("div");
      banner.id = "pendingBanner";
      banner.style.cssText = `
        background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;
        padding:12px 14px;border-radius:12px;margin:16px 0;font-weight:700;
      `;
      banner.textContent =
        "مشروعك قيد المراجعة (Pending) — سيتم فتح المراحل بعد موافقة المشرف.";
      const main = document.querySelector("main") || document.body;
      main.insertBefore(banner, main.firstChild);
    }

    banner.style.display = isPending ? "block" : "none";
    if (stagesContainer) stagesContainer.style.display = isPending ? "none" : "block";
  }

  function updateProgressBar() {
    const phases = getPhases();
    const completed = Object.values(phases).filter(p => p.status === "done").length;

    const percent = Math.round((completed / TOTAL_PHASES) * 100);
    const bar = document.getElementById("progressBar");
    if (!bar) return;

    bar.style.width = percent + "%";
    bar.textContent = percent + "%";
  }

  function updateDashboardStats() {
    const phases = getPhases();
    const total = TOTAL_PHASES;

    let locked = 0;
    let open = 0;
    let done = 0;

    const now = new Date();

    Object.values(phases).forEach(p => {
      const subStatus = String(p.supervisorStatus || "").toLowerCase();

      if (subStatus === "approved") {
        done++;
        return;
      }

      const s = p.startDate ? new Date(p.startDate) : null;
      const e = p.endDate ? new Date(p.endDate) : null;

      if (!s || !e || isNaN(s) || isNaN(e)) {
        locked++;
        return;
      }

      if (now >= s && now <= e) {
        open++;
        return;
      }

      locked++;
    });

    const totalEl = document.getElementById("totalStages");
    const lockedEl = document.getElementById("lockedStages");
    const activeEl = document.getElementById("activeStages");
    const doneEl = document.getElementById("doneStages");

    if (totalEl) totalEl.textContent = total;
    if (lockedEl) lockedEl.textContent = locked;
    if (activeEl) activeEl.textContent = open;
    if (doneEl) doneEl.textContent = done;

    const percent = Math.round((done / total) * 100);
    const bar = document.getElementById("progressBar");
    if (bar) {
      bar.style.width = percent + "%";
      bar.textContent = percent + "%";
    }
  }

  /* ================================
     Load Project + Phases
  ================================ */
  async function loadProjectFromApi() {
    const token = localStorage.getItem("token");
    if (!token) {
      window.location.href = "Auth_Pages/login.html";
      return;
    }

    const res = await fetch(`${API_BASE_URL}/api/projects/my`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "ngrok-skip-browser-warning": "true",
      },
      cache: "no-store",
    });

    if (res.status === 404) {
      window.location.href = "dashboard.html";
      return;
    }

    if (!res.ok) {
      const text = await res.text();
      console.error("Failed /api/projects/my:", res.status, text);
      alert("صار خطأ بجلب بيانات المشروع");
      return;
    }

    const project = await res.json();

    // ✅ خزّن projectId الحقيقي
    CURRENT_PROJECT_ID = project.projectId ?? project.id ?? null;

    const projectStatus = String(project.status || "").toLowerCase();
    if (projectStatus === "pending") {
      applyPendingModeInProgressPage(true);
      initAiReportFeature(CURRENT_PROJECT_ID, false);
      return;
    }

    applyPendingModeInProgressPage(false);

    const phases = {};
    const milestones = Array.isArray(project.milestones) ? project.milestones : [];

    milestones.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    for (let i = 1; i <= TOTAL_PHASES; i++) {
      const ms = milestones.find(m => Number(m.order) === i);

      if (!ms) {
        phases[`phase${i}`] = {
          status: "locked",
          startDate: null,
          endDate: null,
        };
        continue;
      }

      phases[`phase${i}`] = {
        milestoneId: ms.milestoneId,
        status: String(ms.status || "locked").toLowerCase(),
        startDate: ms.startDate || null,
        endDate: ms.endDate || null,

        submittedAt: ms.mySubmission?.uploadedAt || null,
        files: (ms.mySubmission?.files || []).map(f => ({
          id: f.id,
          name: f.name,
          sizeBytes: f.sizeBytes,
          size: f.sizeBytes ? (f.sizeBytes / 1024).toFixed(1) + " KB" : "",
          url: f.url,
        })),
        supervisorComment: ms.mySubmission?.supervisorComment || null,
        supervisorStatus: ms.mySubmission?.status || null,
      };
    }

    savePhases(phases);

    for (let i = 1; i <= TOTAL_PHASES; i++) {
      const phase = phases[`phase${i}`];
      if (!phase) continue;

      const s = document.getElementById(`startDateText${i}`);
      const e = document.getElementById(`endDateText${i}`);
      if (s) s.textContent = formatDT(phase.startDate);
      if (e) e.textContent = formatDT(phase.endDate);

      const card = document.getElementById(`datesCard${i}`);
      if (card && phase.startDate && phase.endDate) card.classList.add("has-dates");
    }

    for (let i = 1; i <= TOTAL_PHASES; i++) loadPhase(i);

    updateProgressBar();
    updateDashboardStats();

    // ✅ AI report availability (final stage)
    const finalPhase = phases["phase7"];
    const finalSubmitted = !!finalPhase?.submittedAt;
    initAiReportFeature(CURRENT_PROJECT_ID, finalSubmitted);
  }

  function resolvePhaseButton(phaseId) {
    // الطبيعي: stage{n}Btn
    let btn = document.getElementById(`stage${phaseId}Btn`);

    // ✅ phase1 عندك زر داخل stage1SubmitBox بدون id
    if (!btn && phaseId === 1) {
      btn = document.querySelector("#stage1SubmitBox .submit-btn");
    }

    return btn;
  }

  function loadPhase(phaseId) {
    const phases = getPhases();
    const data = phases[`phase${phaseId}`];
    if (!data) return;

    const statusText = document.getElementById(`stage${phaseId}StatusText`);
    const submitBox = document.getElementById(`stage${phaseId}SubmitBox`);
    const fileInput = document.getElementById(`stage${phaseId}File`);

    if (!selectedFiles[phaseId]) selectedFiles[phaseId] = [];

    // ✅ phase1 ما عنده file input عادة
    if (fileInput && !fileInput.dataset.bound) {
      fileInput.dataset.bound = "1";

      fileInput.addEventListener("change", () => {
        const newFiles = Array.from(fileInput.files || []);

        newFiles.forEach(f => {
          const exists = selectedFiles[phaseId].some(
            x => x.name === f.name && x.size === f.size
          );
          if (!exists) selectedFiles[phaseId].push(f);
        });

        const hint = document.getElementById(`stage${phaseId}FileHint`);
        if (hint) {
          hint.textContent = selectedFiles[phaseId].length
            ? selectedFiles[phaseId].map(f => f.name).join(" , ")
            : "لم يتم اختيار ملفات";
        }

        fileInput.value = "";
      });
    }

    const btn = resolvePhaseButton(phaseId);
    const submissionInfo = document.getElementById(`stage${phaseId}SubmissionInfo`);
    const submittedAt = document.getElementById(`stage${phaseId}SubmittedAt`);
    const filesList = document.getElementById(`stage${phaseId}Files`);
    const deleteIcon = document.getElementById(`stage${phaseId}DeleteIcon`);
    const card = document.getElementById(`stage${phaseId}Card`);

    // ✅ إذا DOM مش موجود (مثلاً الصفحة مختلفة) لا تكسر
    if (!card) {
      console.warn(`⚠️ Missing DOM for phase ${phaseId}. Check ID: stage${phaseId}Card`);
      return;
    }

    const startDate = data.startDate ? new Date(data.startDate) : null;
    const endDate = data.endDate ? new Date(data.endDate) : null;
    const todayDate = new Date();

    const supervisorBox = document.getElementById(`stage${phaseId}SupervisorBox`);
    const supervisorComment = document.getElementById(`stage${phaseId}SupervisorComment`);

    if (supervisorBox) supervisorBox.classList.add("hidden");
    if (supervisorComment) supervisorComment.textContent = "";

    if (data.supervisorComment && supervisorBox && supervisorComment) {
      supervisorComment.textContent = data.supervisorComment;
      supervisorBox.classList.remove("hidden");
    }

    // Reset
    card.classList.remove("active", "submitted", "completed", "locked");
    if (submissionInfo) submissionInfo.classList.add("hidden");
    if (filesList) filesList.innerHTML = "";
    if (deleteIcon) deleteIcon.style.display = "none";

    // ✅ لو ما في تواريخ
    if (!startDate || !endDate || isNaN(startDate) || isNaN(endDate)) {
      if (submitBox) submitBox.style.display = "none";
      if (btn) {
        btn.textContent = "⏳ بانتظار تحديد المواعيد من المشرف";
        btn.className = "stage-btn locked";
        btn.disabled = true;
      }
      if (fileInput) fileInput.disabled = true;
      card.classList.add("locked");
      return;
    }

    // ✅ قبل بداية الفترة
    if (todayDate < startDate) {
      if (submitBox) submitBox.style.display = "none";
      if (btn) {
        btn.textContent = "🔒 مرحلة مقفلة";
        btn.className = "stage-btn locked";
        btn.disabled = true;
      }
      if (fileInput) fileInput.disabled = true;
      card.classList.add("locked");
    }
    // ✅ داخل الفترة
    else if (todayDate >= startDate && todayDate <= endDate) {
      if (submitBox) submitBox.style.display = "block";
      if (btn) {
        // phase1 زرّه بيفتح wizard أصلاً، فخليه شغال
        btn.textContent = phaseId === 1 ? "📤 تسليم المرحلة" : "📤 تسليم المرحلة";
        btn.className = "stage-btn active";
        btn.disabled = false;
      }
      if (fileInput) fileInput.disabled = false;
      card.classList.add("active");
    }
    // ✅ بعد نهاية الفترة
    else if (todayDate > endDate) {
      if (submitBox) submitBox.style.display = "none";
      if (btn) {
        btn.textContent = "🔒 المرحلة مغلقة";
        btn.className = "stage-btn locked";
        btn.disabled = true;
      }
      if (fileInput) fileInput.disabled = true;
      card.classList.add("locked");
    }

    // ✅ في حالة submitted
    if (data.submittedAt) {
      if (submitBox) submitBox.style.display = "block";

      if (btn) {
        // phase1: خليها "تعديل" بس ما تكسر لو الزر بدون class stage-btn
        btn.textContent = "✏️ تعديل التسليم";
        btn.disabled = false;
      }
      if (fileInput) fileInput.disabled = false;

      if (submissionInfo) submissionInfo.classList.remove("hidden");
      if (submittedAt) submittedAt.textContent = data.submittedAt || "—";

      if (data.files && filesList) {
        filesList.innerHTML = "";
        data.files.forEach((f) => {
          const li = document.createElement("li");
          const href = f.url || "#";
          li.innerHTML = `
            <div class="file-left">
              <div class="file-icon">📄</div>
              <div class="file-name">
                <a href="${href}" target="_blank" rel="noopener">${f.name}</a>
                <small>${f.size || ""}</small>
              </div>
            </div>
            <div class="file-actions">
              <button class="file-del" type="button"
                onclick="removeSubmittedFile(${phaseId}, ${f.id})"
                title="حذف الملف">🗑</button>
            </div>
          `;
          filesList.appendChild(li);
        });
      }

      if (deleteIcon) deleteIcon.style.display = "inline-block";
      card.classList.add("active");

      const st = String(data.supervisorStatus || "").toLowerCase();
      if (st === "approved") {
        if (statusText) statusText.textContent = "مقبول ✅";
        if (btn) {
          btn.textContent = "✅ تمت المراجعة (مقبول)";
          btn.disabled = true;
        }
        if (fileInput) fileInput.disabled = true;
        card.classList.remove("active");
        card.classList.add("completed");
      } else if (st === "rejected") {
        if (statusText) statusText.textContent = "مرفوض ❌";
        if (btn) {
          btn.textContent = "✏️ تعديل وإعادة التسليم";
          btn.disabled = false;
        }
        if (fileInput) fileInput.disabled = false;
        card.classList.add("active");
      } else {
        if (statusText) statusText.textContent = "تم التسليم";
      }

      return;
    }
  }

  /* ==============================
     SUBMIT PHASE (files)
  ============================== */
  async function submitPhase(phaseId) {
    const token = localStorage.getItem("token");
    if (!token) return alert("مش مسجل دخول");

    const phases = getPhases();
    const phase = phases[`phase${phaseId}`];
    const milestoneId = phase?.milestoneId;

    if (!milestoneId) return alert("milestoneId مش موجود");

    const filesArr = selectedFiles[phaseId] || [];
    if (filesArr.length === 0) return alert("يرجى رفع ملف واحد على الأقل");

    const fd = new FormData();
    filesArr.forEach(f => fd.append("Files", f));

    const res = await fetch(`${API_BASE_URL}/api/projects/milestones/${milestoneId}/submit`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "ngrok-skip-browser-warning": "true",
      },
      body: fd,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return alert(err.message || "صار خطأ بالتسليم");
    }

    selectedFiles[phaseId] = [];
    const hint = document.getElementById(`stage${phaseId}FileHint`);
    if (hint) hint.textContent = "لم يتم اختيار ملفات";

    await loadProjectFromApi();
    alert("✅ تم تسليم المرحلة. بانتظار مراجعة المشرف.");
  }
  window.submitPhase = submitPhase;

  async function deleteSubmission(phaseId) {
    const token = localStorage.getItem("token");
    if (!token) return alert("مش مسجل دخول");

    const phases = getPhases();
    const milestoneId = phases[`phase${phaseId}`]?.milestoneId;
    if (!milestoneId) return alert("milestoneId مش موجود");

    if (!confirm("هل أنت متأكد من حذف التسليم؟")) return;

    const res = await fetch(`${API_BASE_URL}/api/projects/milestones/${milestoneId}/submission`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
        "ngrok-skip-browser-warning": "true",
      },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return alert(err.message || "فشل حذف التسليم");
    }

    await loadProjectFromApi();
    alert("✅ تم حذف التسليم");
  }
  window.deleteSubmission = deleteSubmission;

  async function removeSubmittedFile(phaseId, fileId) {
    const token = localStorage.getItem("token");
    if (!token) return alert("مش مسجل دخول");

    if (!confirm("متأكد بدك تحذف الملف؟")) return;

    const res = await fetch(`${API_BASE_URL}/api/projects/submissions/files/${fileId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
        "ngrok-skip-browser-warning": "true",
      },
    });

    if (!res.ok) {
      const t = await res.text();
      console.error(t);
      return alert("فشل حذف الملف");
    }

    await loadProjectFromApi();
    alert("✅ تم حذف الملف");
  }
  window.removeSubmittedFile = removeSubmittedFile;

  /* =========================
     Phase 1 Wizard
  ========================= */
  const stage1Outputs = [
    "Project title and short description",
    "Problem statement and proposed solution",
    "Expected objectives (measurable)",
    "Technologies and tools",
    "Initial timeline",
  ];

  let currentStep = 0;
  const stage1Data = {};

let originalWizardHTML = "";
function openStage1Wizard() {
  currentStep = currentStep ?? 0;

  const modal = document.querySelector(".proposal-modal");

  // خزّن الـ HTML الأصلي مرة وحدة فقط
  if (!originalWizardHTML) {
    originalWizardHTML = modal.innerHTML;
  }

  document.getElementById("stage1Modal").style.display = "flex";
  renderWizard();
}
  window.openStage1Wizard = openStage1Wizard;

  function closeStage1Wizard() {
    const modal = document.getElementById("stage1Modal");
    if (!modal) return;
    modal.style.display = "none";
  }
  window.closeStage1Wizard = closeStage1Wizard;

  function renderWizard() {
    const titleEl = document.getElementById("wizardTitle");
    const badgeEl = document.getElementById("stepBadge");
    const ta = document.getElementById("wizardTextarea");

    if (!titleEl || !badgeEl || !ta) return;

    titleEl.textContent = stage1Outputs[currentStep];
    badgeEl.textContent = String(currentStep + 1);

    ta.value = stage1Data[currentStep] || "";

    const percent = Math.round(((currentStep + 1) / 5) * 100);
    const barFill = document.getElementById("wizardBarFill");
    const percentEl = document.getElementById("progressPercent");
    const textEl = document.getElementById("progressText");
    const subTextEl = document.getElementById("progressSubText");

    if (barFill) barFill.style.width = percent + "%";
    if (percentEl) percentEl.textContent = percent + "%";
    if (textEl) textEl.textContent = `Output ${currentStep + 1} of 5`;
    if (subTextEl) subTextEl.textContent = `Filled ${Object.keys(stage1Data).length} of 5 outputs`;

    const list = document.getElementById("outputsList");
    if (list) {
      list.innerHTML = "";
      stage1Outputs.forEach((t, i) => {
        const li = document.createElement("li");
        li.textContent = t;
        if (i === currentStep) li.classList.add("active");
        if (stage1Data[i]) li.classList.add("done");
        list.appendChild(li);
      });
    }

    const prevBtn = document.getElementById("prevBtn");
    const nextBtn = document.getElementById("nextBtn");
    if (prevBtn) prevBtn.style.display = currentStep === 0 ? "none" : "inline-block";
    if (nextBtn) nextBtn.textContent = currentStep === 4 ? "Save & Finish" : "Save & Next";
  }

  function nextStep() {
    const ta = document.getElementById("wizardTextarea");
    if (!ta) return;

    const val = ta.value.trim();
    if (val.length < 50) {
      alert("Please write at least 50 characters.");
      return;
    }

    stage1Data[currentStep] = val;

    if (currentStep < 4) {
      currentStep++;
      renderWizard();
    } else {
      showFinalSummary();
    }
  }
  window.nextStep = nextStep;

  function prevStep() {
    const ta = document.getElementById("wizardTextarea");
    if (!ta) return;

    stage1Data[currentStep] = ta.value;
    currentStep--;
    renderWizard();
  }
  window.prevStep = prevStep;

  function showFinalSummary() {
  const summary = Object.entries(stage1Data).map(
    ([i, v]) => `
      <div class="summary-item">
        <strong>${stage1Outputs[i]}</strong>
        <p>${v}</p>
      </div>`
  ).join("");

  document.querySelector(".proposal-modal").innerHTML = `
    <h2>جاهز للتسليم النهائي</h2>

    <div class="success-box">
      ✅ تم إدخال جميع المخرجات بنجاح
    </div>

    <div class="ai-box">
      <h4>المرحلة التالية: التحقق من المعايير</h4>
      <ul>
        <li>فحص جودة المحتوى باستخدام الذكاء الاصطناعي</li>
        <li>تقديم اقتراحات تحسين</li>
        <li>إرسال المقترح للمشرف</li>
      </ul>
    </div>

    <div class="summary-box">${summary}</div>

    <div style="display:flex; gap:10px; margin-top:16px;">
      <button class="btn-outline" onclick="backToPreviousStep()">
        ⬅ رجوع للسابق
      </button>

      <button class="btn-primary" onclick="submitAndCheckAI()">
        تسليم المرحلة وبدء التحقق من المعايير
      </button>
    </div>
  `;
}
function backToPreviousStep() {
  const modal = document.querySelector(".proposal-modal");

  // رجّع الـ HTML الأصلي للـ wizard
  modal.innerHTML = originalWizardHTML;

  // رجوع للخطوة السابقة (step 4 → index 3)
  currentStep = 4;

  renderWizard();
}
  /* =========================
     submitStage1Text (text)
     ✅ with fallback endpoints
  ========================= */
  async function submitStage1Text() {
    const token = localStorage.getItem("token");
    if (!token) {
      alert("مش مسجل دخول");
      return;
    }

    const milestoneId = getPhases().phase1?.milestoneId;
    if (!milestoneId) {
      alert("milestoneId مش موجود للمرحلة 1");
      return;
    }

    const endpointsToTry = [
    `${API_BASE_URL}/api/projects/${milestoneId}/submit-text`
    ];

    let lastErr = "";

    for (const url of endpointsToTry) {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true",
        },
        body: JSON.stringify({ outputs: stage1Data }),
      });

      if (res.ok) {
        closeStage1Wizard();
        await loadProjectFromApi();
        alert("✅ تم تسليم المقترح بنجاح");
        return;
      }

      const t = await res.text().catch(() => "");
      lastErr = `URL: ${url} | HTTP ${res.status} | ${t}`;
      // جرّب اللي بعده إذا 404
      if (res.status !== 404) break;
    }

    console.error("submitStage1Text failed:", lastErr);
    alert("فشل التسليم (راجع الكونسول).");
  }
  window.submitStage1Text = submitStage1Text;

  /* =========================
     Phase 1 AI (Criteria + Checklist + Suggest)
  ========================= */
  let phase1CriteriaCache = null;

  function getProjectIdSafe() {
    return CURRENT_PROJECT_ID ? Number(CURRENT_PROJECT_ID) : null;
  }

function buildPhase1PayloadFromStage1Data() {
  const projectId = getProjectIdSafe();
  if (!projectId) throw new Error("لم يتم العثور على projectId (تأكد loadProjectFromApi شغال)");

  return {
    project_id: projectId,
    title_and_desc: stage1Data[0] || "",
    problem_and_solution: stage1Data[1] || "",
    objectives: stage1Data[2] || "",
    tools: stage1Data[3] || "",
    timeline: stage1Data[4] || "",
  };
}


  async function fetchPhase1Criteria() {
    if (phase1CriteriaCache) return phase1CriteriaCache;

    const res = await fetch(`${API_BASE_URL}/api/ai/phase1/criteria`, {
      method: "GET",
      headers: authHeaders({ Accept: "application/json" }),
      cache: "no-store",
    });

    if (!res.ok) {
      const t = await res.text();
      throw new Error(`فشل جلب معايير Phase1: ${t}`);
    }

    const data = await res.json();
    phase1CriteriaCache = data;
    return data;
  }

  async function runPhase1Checklist() {
    const payload = buildPhase1PayloadFromStage1Data();

    const res = await fetch(`${API_BASE_URL}/api/ai/phase1/checklist/run`, {
      method: "POST",
      headers: authHeaders({
        "Content-Type": "application/json",
        Accept: "application/json",
      }),
      body: JSON.stringify(payload),
    });

    const raw = await res.text().catch(() => "");
    if (!res.ok) {
      throw new Error(raw || `HTTP ${res.status}`);
    }

    // حاول parse JSON
    try {
      return JSON.parse(raw);
    } catch {
      throw new Error("Checklist returned non-JSON response: " + raw);
    }
  }

function pickFirstFailedResult(runResult) {
  const results = runResult?.results || runResult?.Results || [];
  if (!Array.isArray(results)) return null;

  return results.find(x =>
    x.is_passed === false ||
    x.isPassed === false ||
    x.is_Passed === false
  ) || null;
}


  function concatStudentTextForSuggest() {
    return [stage1Data[0], stage1Data[1], stage1Data[2], stage1Data[3], stage1Data[4]]
      .filter(Boolean)
      .join("\n\n");
  }

  async function requestPhase1Suggest(criterionId, ruleComment) {
    const criteria = await fetchPhase1Criteria();
    const c = Array.isArray(criteria)
      ? criteria.find(x => x.id === criterionId || x.criterion_id === criterionId)
      : null;

   const payload = {
  criterion_id: criterionId,
  criterion_title: c?.title || c?.criterion_title || `Criterion ${criterionId}`,
  criterion_description: c?.description || c?.criterion_description || "",
  student_text: concatStudentTextForSuggest(),
  rule_comment: ruleComment || "",
  language: "ar",
  type: "general",
};


    const res = await fetch(`${API_BASE_URL}/api/Ai/phase1/ai/suggest`, {
      method: "POST",
      headers: authHeaders({
        "Content-Type": "application/json",
        Accept: "application/json",
      }),
      body: JSON.stringify(payload),
    });

    const raw = await res.text().catch(() => "");
    if (!res.ok) throw new Error(raw || `HTTP ${res.status}`);

    try {
      return JSON.parse(raw);
    } catch {
      throw new Error("Suggest returned non-JSON response: " + raw);
    }
  }

  function showAISuggestion(data) {
    const card = document.querySelector(".criteria-card");
    const panel = document.getElementById("aiSuggestionPanel");
    if (!panel) return;

    const exp = document.getElementById("aiExplanation");
    const txt = document.getElementById("aiSuggestedText");
    const tipsList = document.getElementById("aiTipsList");

    if (exp) exp.textContent = data.explanation || "";
    if (txt) txt.value = data.suggested_text || "";

    if (tipsList) {
      tipsList.innerHTML = "";
      (data.tips || []).forEach(tip => {
        const li = document.createElement("li");
        li.textContent = tip;
        tipsList.appendChild(li);
      });
    }

    window.currentAISuggestion = data;

    if (card) {
      card.classList.remove("success", "error");
      const hasIssues =
        (data.explanation && String(data.explanation).toLowerCase().includes("not")) ||
        (data.tips && data.tips.length > 0);
      if (hasIssues) card.classList.add("error");
      else card.classList.add("success");
    }

    panel.style.display = "block";
    panel.classList.remove("show");
    void panel.offsetWidth;
    panel.classList.add("show");
  }
  window.showAISuggestion = showAISuggestion;

  function closeAISuggestion() {
    const panel = document.getElementById("aiSuggestionPanel");
    if (!panel) return;
    panel.classList.remove("show");
    setTimeout(() => {
      panel.style.display = "none";
    }, 300);
  }
  window.closeAISuggestion = closeAISuggestion;

  function copySuggestedText() {
    const textarea = document.getElementById("aiSuggestedText");
    if (!textarea) return;
    textarea.select();
    document.execCommand("copy");
  }
  window.copySuggestedText = copySuggestedText;

  function applySuggestedText() {
    const data = window.currentAISuggestion;
    if (!data) return;

    const targetInput = document.querySelector(
      `[data-phase="${data.phase_id}"][data-criterion="${data.criterion_id}"]`
    );

    if (targetInput) {
      targetInput.value = document.getElementById("aiSuggestedText")?.value || "";
    }

    closeAISuggestion();
  }
  window.applySuggestedText = applySuggestedText;

  function wirePhase1CriteriaButton() {
    const btn = document.getElementById("criteriaCheckBtn");
    if (!btn) return;

    if (btn.dataset.bound === "1") return;
    btn.dataset.bound = "1";

    btn.addEventListener("click", async () => {
      try {
        if (Object.keys(stage1Data).length < 5) {
          alert("لازم تكتب مخرجات المرحلة الأولى كاملة قبل التحقق.");
          return;
        }

        const runResult = await runPhase1Checklist();

     const passedAll =
  runResult?.passed === true ||
  runResult?.passed_All_Required === true ||
  runResult?.passedAllRequired === true ||
  runResult?.passed_all_required === true;


        if (passedAll) {
          alert("✅ ممتاز! كل المعايير المطلوبة ناجحة.");
          closeAISuggestion();
          return;
        }

        const failed = pickFirstFailedResult(runResult);
        if (!failed) {
          alert("تم الفحص لكن لم أستطع تحديد معيار فاشل لعرض اقتراح.");
          return;
        }

        const criterionId = failed.criterion_Id ?? failed.criterionId ?? failed.criterion_id;
        const ruleComment = failed.comment || failed.rule_comment || "";

        const suggest = await requestPhase1Suggest(Number(criterionId), ruleComment);

        const uiData = {
          phase_id: 1,
          criterion_id: Number(criterionId),
          explanation: suggest.explanation || suggest.reason || "يوجد نقاط تحتاج تحسين.",
          suggested_text: suggest.suggested_text || suggest.suggestedText || suggest.text || "",
          tips: suggest.tips || suggest.suggestions || [],
        };

        showAISuggestion(uiData);
      } catch (e) {
        console.error(e);
        alert("❌ صار خطأ أثناء التحقق من المعايير. شوف الكونسول.");
      }
    });
  }

  async function submitAndCheckAI() {
    try {
      await submitStage1Text();
      const runResult = await runPhase1Checklist();

      const passedAll =
        runResult?.passed_All_Required === true ||
        runResult?.passedAllRequired === true ||
        runResult?.passed_all_required === true;

      if (passedAll) {
        alert("✅ تم التسليم + المعايير ناجحة.");
        closeStage1Wizard();
        return;
      }

      const failed = pickFirstFailedResult(runResult);
      if (!failed) {
        alert("تم التسليم لكن لم أستطع تحديد معيار فاشل.");
        closeStage1Wizard();
        return;
      }

      const criterionId = failed.criterion_Id ?? failed.criterionId ?? failed.criterion_id;
      const ruleComment = failed.comment || failed.rule_comment || "";

      const suggest = await requestPhase1Suggest(Number(criterionId), ruleComment);

      showAISuggestion({
        phase_id: 1,
        criterion_id: Number(criterionId),
        explanation: suggest.explanation || suggest.reason || "يوجد نقاط تحتاج تحسين.",
        suggested_text: suggest.suggested_text || suggest.suggestedText || suggest.text || "",
        tips: suggest.tips || suggest.suggestions || [],
      });
    } catch (e) {
      console.error(e);
      alert("❌ فشل التسليم/التحقق. شوف الكونسول.");
    }
  }
  window.submitAndCheckAI = submitAndCheckAI;

  /* =========================
     AI Phases Report
  ========================= */
  function showAiReportCard(show) {
    const card = document.getElementById("aiReportCard");
    if (card) card.style.display = show ? "block" : "none";
  }

  function setAiStatus(msg) {
    const el = document.getElementById("aiReportStatus");
    if (el) el.textContent = msg || "";
  }

  function getPreferredLang() {
    return "ar";
  }

  async function downloadAiPhasesReportPdf(projectId) {
    const btn = document.getElementById("generateAiReportBtn");
    const link = document.getElementById("aiReportDownloadLink");

    if (!projectId) {
      setAiStatus("⚠️ لم يتم العثور على رقم المشروع.");
      return;
    }

    if (btn) btn.disabled = true;
    setAiStatus("⏳ جاري تجهيز ملف PDF...");

    try {
      const res = await fetch(`${API_BASE_URL}/api/ai/projects/${projectId}/phases-report/pdf`, {
        method: "GET",
        headers: authHeaders({ Accept: "application/pdf" }),
        cache: "no-store",
      });

      if (res.status === 401 || res.status === 403) {
        localStorage.removeItem(TOKEN_KEY);
        window.location.href = "Auth_Pages/login.html";
        return;
      }

      if (!res.ok) {
        const ct = res.headers.get("content-type") || "";
        const data = ct.includes("application/json") ? await res.json() : await res.text();
        const msg = (data && data.message) || (typeof data === "string" ? data : "") || `HTTP ${res.status}`;
        throw new Error(msg);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      if (link) {
        link.href = url;
        link.style.display = "inline-flex";
        link.setAttribute("download", `phases-report-${projectId}.pdf`);
      }

      setAiStatus("✅ تم تجهيز ملف PDF. اضغط (تحميل التقرير PDF).");
    } catch (e) {
      console.error(e);
      setAiStatus(`⚠️ فشل تنزيل PDF: ${e.message || "حدث خطأ"}`);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function generateAiPhasesReport(projectId) {
    const btn = document.getElementById("generateAiReportBtn");
    const link = document.getElementById("aiReportDownloadLink");

    if (!projectId) {
      setAiStatus("⚠️ لم يتم العثور على رقم المشروع.");
      return;
    }

    if (btn) btn.disabled = true;
    if (link) link.style.display = "none";
    setAiStatus("⏳ جاري توليد التقرير وحفظه...");

    const language = getPreferredLang();

    try {
      const res = await fetch(
        `${API_BASE_URL}/api/ai/projects/${projectId}/phases-report?language=${encodeURIComponent(language)}`,
        {
          method: "POST",
          headers: authHeaders({
            Accept: "application/json",
            "Content-Type": "application/json",
          }),
          body: JSON.stringify({}),
        }
      );

      if (res.status === 401 || res.status === 403) {
        localStorage.removeItem(TOKEN_KEY);
        window.location.href = "Auth_Pages/login.html";
        return;
      }

      if (!res.ok) {
        const ct = res.headers.get("content-type") || "";
        const data = ct.includes("application/json") ? await res.json() : await res.text();
        const msg = (data && data.message) || (typeof data === "string" ? data : "") || `HTTP ${res.status}`;
        throw new Error(msg);
      }

      await res.json().catch(() => ({}));

      if (link) {
        link.style.display = "inline-flex";
        link.href = "#";
        link.onclick = (ev) => {
          ev.preventDefault();
          downloadAiPhasesReportPdf(projectId);
        };
      }

      setAiStatus("✅ تم توليد التقرير وحفظه. يمكنك تنزيل PDF الآن.");
    } catch (e) {
      console.error(e);
      setAiStatus(`⚠️ فشل توليد التقرير: ${e.message || "حدث خطأ"}`);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function initAiReportFeature(projectId, finalDone) {
    showAiReportCard(true);

    const btn = document.getElementById("generateAiReportBtn");
    const link = document.getElementById("aiReportDownloadLink");

    if (link) {
      link.style.display = "none";
      link.href = "#";
      link.onclick = null;
    }

    if (!btn) return;

    // 🔧 TEMP FOR TESTING
    btn.disabled = false;
    btn.style.opacity = "1";
    btn.style.cursor = "pointer";

    if (!finalDone) setAiStatus("⚠️ وضع تجريبي: التقرير متاح قبل التسليم النهائي.");
    else setAiStatus("جاهز ✅ يمكنك توليد تقرير الذكاء الاصطناعي.");

    btn.onclick = () => generateAiPhasesReport(projectId);
  }

  /* ================================
     Load user name (Menu + Dashboard)
  ================================ */
  function wireUserName() {
    const name = localStorage.getItem("studentName");
    const token = localStorage.getItem("token");

    if (!name || !token) {
      window.location.href = "Auth_Pages/login.html";
      return;
    }

    const menuName = document.getElementById("menuUserName");
    if (menuName) menuName.innerText = name;

    const avatar = document.querySelector(".user-avatar");
    if (avatar && name) avatar.innerText = name.charAt(0).toUpperCase();

    const welcome = document.getElementById("welcomeText");
    if (welcome) welcome.innerText = `👋 مرحبًا، ${name}`;

    const submitProjectBtn = document.getElementById("submitProjectBtn");
    if (submitProjectBtn) {
      submitProjectBtn.disabled = true;
      submitProjectBtn.style.opacity = "0.6";
      submitProjectBtn.style.cursor = "not-allowed";
    }

    const currentPage = location.pathname.split("/").pop().toLowerCase();
    if (currentPage === "dashboard.html") {
      if (typeof window.loadMyProject === "function") window.loadMyProject();
    }
  }

  function backToPreviousStep() {
  if (currentStep > 0) {
    currentStep--;
    renderWizard();
  }
}
window.backToPreviousStep = backToPreviousStep;


  /* ================================
     Boot
  ================================ */
  document.addEventListener("DOMContentLoaded", () => {
    wireUserName();
    wirePhase1CriteriaButton();
    loadProjectFromApi();
  });

})();
