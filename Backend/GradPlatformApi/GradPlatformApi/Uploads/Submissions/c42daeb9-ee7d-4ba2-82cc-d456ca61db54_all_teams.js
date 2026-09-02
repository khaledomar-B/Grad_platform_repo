

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
              <span class="avatar">${m.initial || (m.name?.charAt(0) ?? "?")}</span>
              ${m.name}
              ${m.me ? `<span class="badge">أنت</span>` : ""}
            </div>
          `).join("")}
        </div>

        <button class="join-btn" onclick="requestJoin(${team.id})">إرسال طلب انضمام</button>
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
            <div class="solo-avatar">${s.initial || (s.name?.charAt(0) ?? "?")}</div>
          </div>

          <div class="solo-skills">
            ${(s.skills || []).map(skill => `<span>${skill}</span>`).join("")}
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

// زر الانضمام (لسا بنعمله بعد ما نحط endpoint)
window.requestJoin = function (teamId) {
  alert("بدنا نربط زر الانضمام مع Endpoint لاحقًا. TeamId = " + teamId);
};

async function initAllTeams() {
  const token = localStorage.getItem("token");
  if (!token) {
    window.location.href = "Auth_Pages/login.html";
    return;
  }

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


