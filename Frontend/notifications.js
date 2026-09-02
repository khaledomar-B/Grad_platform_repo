/* notifications.js
   يجعل notifications.html ديناميكية اعتماداً على NotificationsController
*/

(() => {
  console.log("✅ notifications.js loaded");

  // ✅ ngrok base URL
  const API_BASE_URL = "https://nonverbalized-gushier-alessandra.ngrok-free.dev";

  // عناصر الصفحة
  const listEl = document.querySelector("ul.notifications-list");
  const markAllBtn = document.querySelector(".mark-all-read-btn");
  const badgeEl = document.querySelector(".notifications-header-icon .badge");
  const headerSubTextEl = document.querySelector(".page-header p");

  // ===== Auth helpers =====
  function getToken() {
    return localStorage.getItem("token") || "";
  }

  function getStudentName() {
    return localStorage.getItem("studentName") || "";
  }

  function authHeaders() {
    const token = getToken();
    const headers = {
      "Content-Type": "application/json",
      "ngrok-skip-browser-warning": "true", // ⭐ مهم مع ngrok
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
  }

  async function apiFetch(path, options = {}) {
    const url = `${API_BASE_URL}${path}`;
    console.log("➡️ Fetch:", url);

    const res = await fetch(url, {
      ...options,
      headers: { ...authHeaders(), ...(options.headers || {}) },
    });

    console.log("⬅️ Status:", res.status);

    if (res.status === 401 || res.status === 403) {
      console.warn("🔒 Unauthorized – redirecting to login");
      window.location.href = "Auth_Pages/login.html";
      return null;
    }

    if (res.status === 204) return null;

    const ct = res.headers.get("content-type") || "";
    const data = ct.includes("application/json")
      ? await res.json()
      : await res.text();

    console.log("📦 Response:", data);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    return data;
  }

  // ===== UI helpers =====
  function uiTypeToWrapperClass(uiType) {
    const t = String(uiType || "").toLowerCase();
    if (t.includes("join")) return "type-join";
    if (t.includes("comment")) return "type-comment";
    if (t.includes("approval")) return "type-approval";
    if (t.includes("deadline")) return "type-deadline";
    return "type-approval";
  }

  function uiTypeToIconClass(uiType) {
    const t = String(uiType || "").toLowerCase();
    if (t.includes("join")) return "fas fa-user-plus";
    if (t.includes("comment")) return "fas fa-comment-dots";
    if (t.includes("approval")) return "fas fa-check-circle";
    if (t.includes("deadline")) return "fas fa-calendar-alt";
    return "fas fa-bell";
  }

  function setCounts(unreadCount) {
    const n = Number(unreadCount || 0);

    if (badgeEl) badgeEl.textContent = String(n);

    if (headerSubTextEl) {
      if (n === 0) headerSubTextEl.textContent = "لا يوجد إشعارات جديدة";
      else if (n === 1) headerSubTextEl.textContent = "لديك إشعار جديد";
      else if (n === 2) headerSubTextEl.textContent = "لديك إشعاران جديدان";
      else headerSubTextEl.textContent = `لديك ${n} إشعار جديد`;
    }
  }

  function clearList() {
    if (listEl) listEl.innerHTML = "";
  }

  function renderEmptyState() {
    if (!listEl) return;
    const li = document.createElement("li");
    li.className = "notification-item";
    li.style.justifyContent = "center";
    li.style.padding = "18px";
    li.textContent = "لا يوجد إشعارات حالياً";
    listEl.appendChild(li);
  }

  function buildNotificationItem(n) {
    const li = document.createElement("li");
    li.className = `notification-item${n.isRead ? "" : " unread"}`;

    const indicator = document.createElement("div");
    indicator.className = "notification-indicator";

    const iconWrap = document.createElement("div");
    iconWrap.className = `notification-icon-wrapper ${uiTypeToWrapperClass(n.uiType)}`;

    const icon = document.createElement("i");
    icon.className = uiTypeToIconClass(n.uiType);
    iconWrap.appendChild(icon);

    const content = document.createElement("div");
    content.className = "notification-content";

    const title = document.createElement("div");
    title.className = "notification-title";
    title.textContent = n.title || "إشعار";

    const desc = document.createElement("div");
    desc.className = "notification-description";
    desc.textContent = n.message || "";

    content.appendChild(title);
    content.appendChild(desc);

    const meta = document.createElement("div");
    meta.className = "notification-meta";

    if (!n.isRead) {
      const badge = document.createElement("span");
      badge.className = "notification-badge";
      badge.textContent = "جديد";
      meta.appendChild(badge);
    }

    const time = document.createElement("span");
    time.className = "notification-time";
    time.textContent = n.timeLabel || "";
    meta.appendChild(time);

    li.addEventListener("click", async () => {
      try {
        if (!n.isRead) {
          await apiFetch(`/api/Notifications/${n.id}/read`, { method: "PATCH" });
          n.isRead = true;
          li.classList.remove("unread");
          await refreshUnreadCountOnly();
        }

        // ✅ جاهز للـ redirect لاحقًا
        // if (n.data) {
        //   const payload = JSON.parse(n.data);
        //   if (payload.url) window.location.href = payload.url;
        // }

      } catch (e) {
        console.error(e);
      }
    });

    li.append(indicator, iconWrap, content, meta);
    return li;
  }

  // ===== API calls =====
  async function loadNotificationsAll() {
    const data = await apiFetch(`/api/Notifications?filter=all`, { method: "GET" });
    if (!data) return;

    const unreadCount = data.unreadCount ?? data.UnreadCount ?? 0;
    const itemsRaw = data.items ?? data.Items ?? [];
    const items = Array.isArray(itemsRaw) ? itemsRaw : [];

    console.log("🧩 Parsed items:", items);

    setCounts(unreadCount);
    clearList();

    if (!items.length) {
      renderEmptyState();
      return;
    }

    const frag = document.createDocumentFragment();
    items.forEach(n => frag.appendChild(buildNotificationItem(n)));
    listEl.appendChild(frag);
  }

  async function refreshUnreadCountOnly() {
    const data = await apiFetch(`/api/Notifications/unread-count`, { method: "GET" });
    if (!data) return;
    setCounts(data.unreadCount ?? data.UnreadCount ?? 0);
  }

  async function markAllRead() {
    await apiFetch(`/api/Notifications/read-all`, { method: "PATCH" });
  }

  // ===== Init =====
  function initMenuUser() {
    const name = getStudentName();
    const token = getToken();
    if (!name || !token) {
      window.location.href = "Auth_Pages/login.html";
      return false;
    }

    const menuName = document.getElementById("menuUserName");
    if (menuName) menuName.innerText = name;

    const avatar = document.querySelector(".user-avatar");
    if (avatar) avatar.innerText = name.charAt(0).toUpperCase();

    return true;
  }

  async function init() {
    if (!initMenuUser()) return;

    if (markAllBtn) {
      markAllBtn.addEventListener("click", async () => {
        markAllBtn.disabled = true;
        await markAllRead();
        await loadNotificationsAll();
        markAllBtn.disabled = false;
      });
    }

    await loadNotificationsAll();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
