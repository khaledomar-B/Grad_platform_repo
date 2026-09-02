#ai_groq.py
import os, json
from dotenv import load_dotenv
from groq import Groq

load_dotenv()
api_key = os.getenv("GROQ_API_KEY")
if not api_key:
    raise RuntimeError("GROQ_API_KEY not set in .env")

client = Groq(api_key=api_key)

def rules_for(t: str) -> str:
    t = (t or "general").lower().strip()
    if t == "objectives":
        return "الأهداف: نقاط واضحة تبدأ بأفعال، 3-5 أهداف، قابلة للقياس قدر الإمكان."
    if t == "problem_solution":
        return "المشكلة: اذكر أثرها. الحل: كيف يعالج المشكلة + من سيستخدمه."
    if t == "tools":
        return "التقنيات: صنّف Frontend/Backend/DB واذكر 3-6 أدوات."
    if t == "timeline":
        return "الجدول الزمني: مراحل + أسابيع/أشهر بشكل منظم."
    if t == "title_desc":
        return "عنوان واضح + وصف مختصر يوضح الفكرة والقيمة."
    return "اجعل النص واضحًا، محددًا، ومنظمًا وتجنب العمومية."

def suggest(payload: dict) -> dict:
    lang = (payload.get("language") or "ar").lower()
    target_language = "Arabic" if lang == "ar" else "English"
    rule_comment = payload.get("rule_comment") or "لا توجد ملاحظة من التقييم الآلي."

    system_prompt = (
    "You are a strict academic assistant for a university graduation project checklist. "
    "You MUST follow the provided criterion and rules. "
    "Your job is to help the student edit their text to satisfy the rubric and pass the automatic checks. "
    "Return ONLY valid JSON that matches the exact schema. No markdown, no extra keys, no extra text."
)


    user_prompt = f"""
You are given:
1) A checklist criterion (title + description)
2) A rule-based evaluation comment (why it failed or what is missing)
3) The student's current text
4) Writing rules for this criterion type

Your tasks:
A) Explanation: In 2-4 short sentences, explain what is missing/weak based ONLY on the criterion + rule comment.
B) Suggested_text: Rewrite the student's text so it would PASS the rubric and satisfy the rules.
   
   - Keep the student's meaning and topic.
   - Add missing details (specific, concrete).
   - If the text is empty or too short, create a complete improved version.
   - Format:
     * If criterion type is 'objectives' → 3–5 bullet points starting with action verbs.
     * If type is 'tools' → split into Frontend / Backend / Database (and optionally AI/Other) with 3–6 tools total.
     * If type is 'timeline' → short phased timeline with weeks/months.
C) Tips: Provide 3–5 very specific tips (no generic advice like "be clear").

Hard constraints:
- Output MUST be valid JSON.
- Output MUST include exactly these keys: explanation, suggested_text, tips
- tips MUST be an array of strings.
- Do NOT include markdown or extra text.
- Language MUST match the student's text language: {target_language}

Criterion: {payload["criterion_title"]}
Description: {payload["criterion_description"]}

Rule-based comment (reason):
{rule_comment}

Student text ({target_language}):
\"\"\"{payload["student_text"]}\"\"\"

Rules for this criterion type:
{rules_for(payload.get("type"))}

Return JSON only in exactly this format:
{{
  "explanation": "string",
  "suggested_text": "string",
  "tips": ["string", "string", "string"]
}}
"""

    completion = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[{"role": "system", "content": system_prompt},
                  {"role": "user", "content": user_prompt}],
        temperature=0.2,
        max_tokens=350,
        response_format={"type": "json_object"} 

    )

    raw = completion.choices[0].message.content or "{}"
    return json.loads(raw)
