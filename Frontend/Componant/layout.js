async function loadLayoutParts() {
    // تحميل الهيدر
    const headerHtml = await (await fetch("/Componant/header.html")).text();
    document.getElementById("header-container").innerHTML = headerHtml;

    // تحميل السايدبار
    const sidebarHtml = await (await fetch("/Componant/sidebar.html")).text();
    document.getElementById("sidebar-container").innerHTML = sidebarHtml;

    // بعد تحميل العناصر — نفعل السلوكيات
    initSidebar();
    highlightActivePage();
}


/* =============================
   تفعيل القائمة في الموبايل
============================= */
function initSidebar() {
    const menuToggle = document.getElementById("menuToggle");
    const sidebar = document.getElementById("sidebar");

    if (!menuToggle || !sidebar) {
        // إعادة المحاولة بعد 100ms
        setTimeout(initSidebar, 100);
        return;
    }

    // فتح وإغلاق السايدبار
    menuToggle.addEventListener("click", () => {
        sidebar.classList.toggle("active");
        document.body.classList.toggle("sidebar-open");
    });

    // إغلاق عند الضغط خارج السايدبار
    document.addEventListener("click", (e) => {
        if (!sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
            sidebar.classList.remove("active");
            document.body.classList.remove("sidebar-open");
        }
    });
}


/* =============================
   تمييز الصفحة الحالية (Active)
============================= */
function highlightActivePage() {
    const menuItems = document.querySelectorAll(".menu-item");

    if (!menuItems.length) {
        // إعادة المحاولة للتأكد إن السايدبار اتحمل
        setTimeout(highlightActivePage, 100);
        return;
    }

    // استخراج اسم الملف من URL
    let path = window.location.pathname;
    let currentPage = path.split("/").pop().toLowerCase(); // ex: ideasgenerator.html

    menuItems.forEach(item => {
        let href = item.getAttribute("href");

        if (!href || href === "#") return;

        let cleanHref = href.toLowerCase().split("/").pop(); // ignore folders

        if (cleanHref === currentPage) {
            item.classList.add("active");

            // إضافة الشريط الأصفر على اليسار
            if (!item.querySelector(".active-bar")) {
                const bar = document.createElement("span");
                bar.classList.add("active-bar");
                item.prepend(bar);
            }
        }
    });
}


// تحميل الأجزاء بعد فتح الصفحة
loadLayoutParts();
