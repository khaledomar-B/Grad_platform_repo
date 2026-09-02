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

/* ================================
   Helpers
================================ */
function setInput(selector, value) {
  const el = document.querySelector(selector);
  if (!el) return;
  el.value = value ?? "";
}

function setTextarea(selector, value) {
  const el = document.querySelector(selector);
  if (!el) return;
  el.value = value ?? "";
}

function splitName(fullName) {
  const parts = String(fullName || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

/* ================================
   Load Profile (Edit Mode)
================================ */
async function loadEditProfileFromApi() {
  const token = localStorage.getItem("token");
  if (!token) {
    window.location.href = "Auth_Pages/login.html";
    return;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/api/students/me/profile`, {
      headers: authHeaders(token),
      cache: "no-store",
    });

    if (!res.ok) {
      console.error("Profile fetch failed:", res.status, await res.text());
      alert("صار خطأ بجلب بيانات الملف الشخصي");
      return;
    }

    const data = await res.json();

    /* ===== Avatar / Header ===== */
    const nameParts = splitName(data.fullName);

    document.getElementById("profileFullName").textContent = data.fullName || "—";
    document.getElementById("profileMajor").textContent = data.major || "—";
    document.getElementById("profileStudentNumber").textContent =
      data.universityId || "—";

    /* ===== Disabled fields ===== */
    setInput("#editFirstName", nameParts.firstName);
    setInput("#editLastName", nameParts.lastName);
    setInput("#editEmail", data.email);
    setInput("#editStudentNumber", data.universityId);
    setInput("#editMajor", data.major);

    /* ===== Editable fields ===== */
    setInput("#github", data.github);
    setInput("#linkedin", data.linkedin);
    setTextarea("#bio", data.bio);
    setInput("#skills", (data.skills || []).join(", "));



    /* ===== Sidebar ===== */
    const menuName = document.getElementById("menuUserName");
    if (menuName) menuName.textContent = data.fullName || "";

    const avatar = document.querySelector(".user-avatar");
    if (avatar && data.fullName) {
      avatar.textContent = data.fullName.charAt(0).toUpperCase();
    }

    localStorage.setItem("studentName", data.fullName);

  } catch (err) {
    console.error("Edit profile error:", err);
    alert("حدث خطأ غير متوقع");
  }
}

/* ================================
   Save Profile
================================ */
document.getElementById("profileForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const token = localStorage.getItem("token");
  if (!token) return;

  const payload = {
    github: document.getElementById("github").value.trim(),
    linkedin: document.getElementById("linkedin").value.trim(),
    bio: document.getElementById("bio").value.trim(),
    skills: document
      .getElementById("skills")
      .value.split(",")
      .map(s => s.trim())
      .filter(Boolean),
  };

  try {
    const res = await fetch(`${API_BASE_URL}/api/students/me/profile`, {
      method: "PUT",
      headers: {
        ...authHeaders(token),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const t = await res.text();
      console.error("Save failed:", t);
      alert("فشل حفظ التعديلات");
      return;
    }

    alert("✅ تم حفظ التعديلات بنجاح");
    window.location.href = "profile.html";

  } catch (err) {
    console.error("Save profile error:", err);
    alert("حدث خطأ أثناء الحفظ");
  }
});

/* ================================
   Init
================================ */
document.addEventListener("DOMContentLoaded", loadEditProfileFromApi);
