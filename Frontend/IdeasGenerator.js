

/* ================================
   Logout
================================ */
function handleLogout() {
  window.location.href = "/Auth_Pages/login.html";
}

// =============================
// عناصر الصفحة
// =============================
const majorSelect = document.getElementById("majorSelect");
const interestsInput = document.getElementById("interestsInput");
const keywordsInput = document.getElementById("keywordsInput");

const generateBtn = document.getElementById("generateIdeasBtn");

const emptyState = document.getElementById("ideasEmptyState");
const resultsSection = document.getElementById("ideasResults");
const ideasList = document.getElementById("ideasList");
const ideasCount = document.getElementById("ideasCount");

// =============================
// رابط الباك إند (OpenAI)
// =============================
const IDEAS_API_URL =
  "https://nonverbalized-gushier-alessandra.ngrok-free.dev/api/ai/generate-ideas";


// =============================
// تطبيع الاستجابة (حتى لو رجعت Non-JSON Response كنص)
// =============================
function extractJsonArray(text) {
  if (typeof text !== "string") return null;

  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) return null;

  const jsonStr = text.slice(start, end + 1);
  try {
    const parsed = JSON.parse(jsonStr);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function normalizeIdeas(data) {
  if (!data || !Array.isArray(data.ideas)) return [];

  // الحالة اللي صارت عندك: Non-JSON Response وبداخل description في JSON كنص
  if (
    data.ideas.length === 1 &&
    data.ideas[0]?.title === "Non-JSON Response" &&
    typeof data.ideas[0]?.description === "string"
  ) {
    const parsed = extractJsonArray(data.ideas[0].description);
    if (parsed) return parsed;
  }

  return data.ideas;
}

function normalizeIdeaFields(idea) {
  const tools =
    idea.recommended_tools ??
    idea.recommendedTools ??
    idea.recommendedtools ??
    [];

  return {
    title: idea.title ?? "",
    description: idea.description ?? "",
    difficulty: idea.difficulty ?? "",
    recommended_tools: Array.isArray(tools) ? tools : [],
  };
}


// =============================
// حدث الضغط على زر توليد الأفكار
// =============================
generateBtn.addEventListener("click", async () => {
  const major = majorSelect.value.trim();
  const interests = interestsInput.value.trim();
  const keywords = keywordsInput.value.trim();

  // التحقق من الإدخال
  if (!major || major === "اختر التخصص الأكاديمي") {
    alert("يرجى اختيار التخصص الأكاديمي");
    return;
  }
  if (!interests) {
    alert("يرجى إدخال اهتماماتك التقنية");
    return;
  }

  // حالة الانتظار
  emptyState.style.display = "none";
  resultsSection.style.display = "block";
  ideasList.innerHTML = `
        <div style="text-align:center; padding:20px; color:#555; font-size:16px;">
            ⏳ جاري توليد الأفكار... الرجاء الانتظار
        </div>
    `;

  try {
    const res = await fetch(IDEAS_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ major, interests, keywords }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(errText);
    }
    const data = await res.json();

    let ideas = normalizeIdeas(data).map(normalizeIdeaFields);


    if (!ideas || ideas.length === 0) {
      ideasList.innerHTML = `
                <div style="text-align:center; padding:20px; color:#777; font-size:16px;">
                    ❌ لم يتم العثور على أفكار.
                </div>
            `;
      return;
    }

    // تحديث العداد
    ideasCount.textContent = `(${ideas.length})`;

    // =============================
    // رسم الكروت من كائنات الـ JSON
    // =============================
    ideasList.innerHTML = ideas
      .map((idea, index) => {
        // حماية لو بعض الحقول ناقصة
        const title = idea.title || `Idea ${index + 1}`;
        const description = idea.description || "";
        const difficultyRaw = (idea.difficulty || "").toString();
        const toolsArray = Array.isArray(idea.recommended_tools)
          ? idea.recommended_tools
          : [];

        // تحديد كلاس مستوى الصعوبة
        let difficultyClass = "difficulty-medium";
        const diffLower = difficultyRaw.toLowerCase();
        if (diffLower.includes("easy")) difficultyClass = "difficulty-easy";
        else if (diffLower.includes("hard")) difficultyClass = "difficulty-hard";

        // بناء HTML الكرت
        return `
            <div class="idea-card">

                <div class="idea-header">
                    <div class="idea-title">${title}</div>
                    <div class="idea-index">${index + 1}</div>
                </div>

                <div class="idea-description">
                    ${description}
                </div>

                <div class="idea-tags">
                    ${difficultyRaw
            ? `<span class="idea-tag ${difficultyClass}">
                             مستوى: ${difficultyRaw}
                           </span>`
            : ""
          }
                    ${toolsArray
            .map((tool) => `<span class="idea-tag">${tool}</span>`)
            .join("")}
                </div>

            </div>
        `;
      })
      .join("");
  } catch (err) {
    ideasList.innerHTML = `
            <div style="text-align:center; padding:20px; color:red;">
                ❌ حدث خطأ أثناء الاتصال بالسيرفر.
            </div>
        `;
    console.error(err);
  }
});


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