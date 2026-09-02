

/* ================================
   Logout
================================ */
function handleLogout() {
  window.location.href = "/Auth_Pages/login.html";
}

function authHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
    "ngrok-skip-browser-warning": "true",
  };
}

function setTextById(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = value ?? "—";
}

function setLink(id, url) {
  const a = document.getElementById(id);
  if (!a) return;

  const u = (url || "").trim();
  if (!u) {
    a.style.display = "none";
    a.removeAttribute("href");
    return;
  }

  a.style.display = "inline-flex";
  a.href = u;
}

function renderSkills(skills) {
  const box = document.getElementById("profileSkills");
  if (!box) return;

  box.innerHTML = "";
  (skills || []).forEach((s) => {
    const span = document.createElement("span");
    span.textContent = s;
    box.appendChild(span);
  });
}

function splitName(fullName) {
  const parts = String(fullName || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) return { firstName: "—", lastName: "—" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "—" };

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

async function loadProfileFromApi() {
  const token = localStorage.getItem("token");
  if (!token) {
    window.location.href = "Auth_Pages/login.html";
    return;
  }



  const res = await fetch(`${API_BASE_URL}/api/students/me/profile`, {
    headers: authHeaders(token),
    cache: "no-store",
  });

  if (!res.ok) {
    console.error("GET profile failed:", res.status, await res.text());
    alert("صار خطأ بجلب بيانات الملف الشخصي");
    return;
  }

  const data = await res.json();

  // ===== Header (IDs اللي أضفتهم بالهيدر) =====
  setTextById("profileFullName", data.fullName);
  setTextById("profileMajor", data.major);
  setTextById("profileStudentNumber", data.universityId);

  // ===== Personal info grid =====
  const nameParts = splitName(data.fullName);
  setTextById("pFirstName", nameParts.firstName);
  setTextById("pLastName", nameParts.lastName);
  setTextById("pStudentNumber", data.universityId);
  setTextById("pEmail", data.email);
  setTextById("pMajor", data.major);

  // ===== Editable fields =====
  setTextById("profileBio", data.bio);
  setLink("profileGithub", data.github);
  setLink("profileLinkedin", data.linkedin);
  renderSkills(data.skills);



  // ===== Sidebar user (Dash menu) =====
  const menuName = document.getElementById("menuUserName");
  if (menuName) menuName.textContent = data.fullName || "";

  const menuAvatar = document.querySelector(".user-avatar");
  if (menuAvatar && data.fullName) {
    menuAvatar.textContent = data.fullName.charAt(0).toUpperCase();
  }

  // (اختياري) خزّن الاسم لملفات ثانية إذا DashScript بستخدمه
  if (data.fullName) localStorage.setItem("studentName", data.fullName);
}

document.addEventListener("DOMContentLoaded", loadProfileFromApi);
