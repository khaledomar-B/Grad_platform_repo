const API_BASE_URL = "https://nonverbalized-gushier-alessandra.ngrok-free.dev"; // نفس تبعك
const TOKEN_KEY = "token"; // خليه ثابت بكل المشروع

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

async function loadCurrentUser() {
  const token = getToken();
  if (!token) return null;

  const res = await fetch(`${API_BASE_URL}/api/users/me`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) return null;
  return await res.json();
}

function applyUserToUI(user) {
  if (!user) return;

  // 1) اسم المستخدم بالمنيو (يظهر بكل الصفحات)
  const menuNameEl = document.getElementById("menuUserName");
  if (menuNameEl) menuNameEl.textContent = user.fullName;

  // 2) الترحيب بالداشبورد فقط (إذا العنصر موجود)
  const welcomeEl = document.getElementById("welcomeText");
  if (welcomeEl) welcomeEl.textContent = `مرحبًا، ${user.fullName} 👋`;
}

async function initUserUI() {
  try {
    // لو كنت خزّنت الاسم مسبقًا من login، اعرضه بسرعة أولًا
    const cachedName = localStorage.getItem("studentName");
    if (cachedName) {
      applyUserToUI({ fullName: cachedName });
    }

    // بعدين هات الاسم الحقيقي من DB (الأصح)
    const user = await loadCurrentUser();
    if (user?.fullName) {
      localStorage.setItem("studentName", user.fullName); // كاش للاستخدام السريع
      applyUserToUI(user);
    }
  } catch (e) {
    console.error("initUserUI error:", e);
  }
}
