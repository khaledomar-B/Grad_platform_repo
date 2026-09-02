

/* ================================
   Logout
================================ */
function handleLogout() {
  window.location.href = "/Auth_Pages/login.html";
}

/* =========================
   All Teams - Real API
========================= */

async function fetchJSON(url, token) {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "ngrok-skip-browser-warning": "true",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`${res.status} ${txt}`);
  }
  return res.json();
}

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


/* =========================
   Student Profile (Modal)
   Uses: GET /api/students/{studentId}/profile
========================= */

function openStudentProfileModal() {
  document.getElementById("studentProfileModal")?.classList.remove("sp-hidden");
  document.body.classList.add("sp-noscroll");
}

function closeStudentProfileModal() {
  document.getElementById("studentProfileModal")?.classList.add("sp-hidden");
  document.body.classList.remove("sp-noscroll");
}

async function openStudentProfile(studentId) {
  try {
    const token = localStorage.getItem("token");
    if (!token) return alert("مش مسجل دخول");

    openStudentProfileModal();

    document.getElementById("spAvatar").textContent = "…";
    document.getElementById("spName").textContent = "جاري التحميل...";
    document.getElementById("spMajor").textContent = "";
    document.getElementById("spBio").textContent = "";
    document.getElementById("spSkills").innerHTML = "";

    const res = await fetch(`${API_BASE_URL}/api/students/${studentId}/profile`, {
      headers: headersWithToken(token),
      cache: "no-store",
    });

    if (!res.ok) {
      const t = await res.text();
      console.error("profile fetch failed:", res.status, t);
      document.getElementById("spName").textContent = "فشل تحميل البروفايل";
      return;
    }

    const p = await res.json();

    document.getElementById("spAvatar").textContent = safeChar(p.fullName || p.name);
    document.getElementById("spName").textContent = p.fullName || p.name || "—";
    document.getElementById("spMajor").textContent = p.major || "—";
    document.getElementById("spBio").textContent = (p.bio && p.bio.trim()) ? p.bio : "لا يوجد نبذة.";

    const emailEl = document.getElementById("spEmail");
    const email = p.email || "";
    if (emailEl) {
      emailEl.textContent = email || "—";
      emailEl.href = email ? `mailto:${email}` : "#";
      emailEl.style.pointerEvents = email ? "auto" : "none";
    }

    const ghEl = document.getElementById("spGithub");
    const gh = p.github || p.gitHub || "";
    if (ghEl) {
      ghEl.textContent = gh || "—";
      ghEl.href = gh ? gh : "#";
      ghEl.style.pointerEvents = gh ? "auto" : "none";
    }

    const liEl = document.getElementById("spLinkedin");
    const li = p.linkedin || p.linkedIn || "";
    if (liEl) {
      liEl.textContent = li || "—";
      liEl.href = li ? li : "#";
      liEl.style.pointerEvents = li ? "auto" : "none";
    }

    const skillsBox = document.getElementById("spSkills");
    const skills = Array.isArray(p.skills) ? p.skills : [];
    if (skillsBox) {
      if (!skills.length) {
        skillsBox.innerHTML = `<span style="color:#6b7280;">لا يوجد مهارات</span>`;
      } else {
        skillsBox.innerHTML = skills.map(s => `<span class="sp-skill">${s}</span>`).join("");
      }
    }
  } catch (e) {
    console.error(e);
    document.getElementById("spName").textContent = "صار خطأ أثناء تحميل البروفايل";
  }
}

function setupStudentProfileModalEvents() {
  document.getElementById("studentProfileOverlay")?.addEventListener("click", closeStudentProfileModal);
  document.getElementById("studentProfileCloseBtn")?.addEventListener("click", closeStudentProfileModal);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeStudentProfileModal();
  });
}

function renderTeams(teamsData) {
  const container = document.getElementById("allTeamsContainer");
  container.innerHTML = `<h3>جميع الفرق (${teamsData.length})</h3>`;

  teamsData.forEach(team => {
    const completion = team.membersLimit
      ? Math.round((team.members.length / team.membersLimit) * 100)
      : 0;

    container.innerHTML += `
      <div class="team-card">
        <div class="team-header">
          <div class="team-count">${team.members.length}/${team.membersLimit}<br>أعضاء</div>
          <div>
            <h4>${team.name}</h4>
            <p>${team.description || ""}</p>
          </div>
        </div>

        <div class="team-progress">
          <span>${completion}%</span>
          <div class="progress-bar">
            <div style="width:${completion}%"></div>
          </div>
        </div>

        <div class="team-members">
          <strong>أعضاء الفريق:</strong>
          ${team.members.map(m => `
            <div class="member ${m.me ? "highlight" : ""}">
             <span class="avatar sp-click"
      title="عرض البروفايل"
      onclick="openStudentProfile(${m.studentId})">
  ${m.initial || (m.name?.charAt(0) ?? "?")}
</span>

              ${m.name}
              ${m.me ? `<span class="badge">أنت</span>` : ""}
            </div>
          `).join("")}
        </div>

        <button class="join-btn"
        onclick="requestJoin(${team.id}, this)">
  إرسال طلب انضمام
</button>

      </div>
    `;
  });
}

function renderSoloStudents(soloStudents) {
  const container = document.getElementById("soloStudentsContainer");
  container.innerHTML = `<h3>طلاب بدون فريق (${soloStudents.length})</h3>`;

  container.innerHTML += `
    <div class="solo-grid">
      ${soloStudents.map(s => `
        <div class="solo-card">
          <div class="solo-top">
            <div>
              <h4>${s.name}</h4>
              <p>${s.major || ""}</p>
            </div>
          <div class="solo-avatar sp-click"
     title="عرض البروفايل"
     onclick="openStudentProfile(${s.studentId})">
  ${s.initial || (s.name?.charAt(0) ?? "?")}
</div>

          </div>

          <div class="solo-skills">
            ${(s.skills || []).map(skill => `<span>${skill}</span>`).join("")}
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

// ================================
// Send Join Request
// ================================
window.requestJoin = async function (teamId, btn) {
  const token = localStorage.getItem("token");
  if (!token) {
    window.location.href = "Auth_Pages/login.html";
    return;
  }

  // حماية من الضغط المتكرر
  if (btn.disabled) return;

  try {
    btn.disabled = true;
    btn.innerText = "جاري الإرسال...";
    btn.style.opacity = "0.7";

    const res = await fetch(`${API_BASE_URL}/api/teams/${teamId}/join-request`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Accept": "application/json",
        "ngrok-skip-browser-warning": "true"
      }
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(txt);
    }

    // ✅ نجاح
    btn.innerText = "تم إرسال طلب انضمام";
    btn.classList.add("sent");
    btn.disabled = true;

  } catch (err) {
    console.error("Join request error:", err);

    btn.disabled = false;
    btn.innerText = "إرسال طلب انضمام";
    btn.style.opacity = "1";

    alert(
      err.message.includes("الفريق مكتمل")
        ? "❌ الفريق مكتمل"
        : err.message.includes("مشروع آخر")
          ? "❌ أنت مرتبط بمشروع آخر"
          : "❌ لم يتم إرسال الطلب"
    );
  }
};


async function initAllTeams() {
  const token = localStorage.getItem("token");
  if (!token) {
    window.location.href = "Auth_Pages/login.html";
    return;
  }

  setupStudentProfileModalEvents();

  try {
    // ✅ هذول endpoints بدنا نعملهم بالباك
    const data = await fetchJSON(`${API_BASE_URL}/api/teams/overview`, token);

    // نتوقع:
    // data.teams = [...]
    // data.soloStudents = [...]
    renderTeams(data.teams || []);
    renderSoloStudents(data.soloStudents || []);
  } catch (e) {
    console.error(e);
    alert("صار خطأ بجلب بيانات الفرق");
  }
}

window.addEventListener("load", initAllTeams);


