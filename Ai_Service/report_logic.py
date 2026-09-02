"""
File: report_logic.py
Purpose:
This file contains the core AI logic responsible for generating
a structured summary report for graduation projects.

What this file does:
- Builds a strict and controlled prompt for the AI model.
- Ensures the AI summarizes ONLY the content provided by the student.
- Handles missing steps by explicitly marking them as "Not provided by the student".
- Enforces a fixed academic structure (7 steps + overall summary).
- Supports both English and Arabic output.

Important design decision:
This file does NOT interact with any database or API endpoints.
It only prepares prompts and communicates with the AI model.
This separation keeps the AI logic clean, reusable, and easy to test.
"""

from __future__ import annotations

from typing import List, Dict, Any
from groq import Groq


def build_prompt(steps: List[Dict[str, Any]], language: str) -> str:
    """
    Builds a strict prompt that:
    - Summarizes only provided content
    - Marks missing steps clearly
    - Outputs fixed headings
    """

    lang = (language or "en").lower()
    missing_text = (
        "لم يتم تزويد هذه الخطوة من قبل الطالب."
        if lang == "ar"
        else "Not provided by the student."
    )

    # Normalize steps into maps (ensure we can fetch by stepNumber)
    step_map = {}
    content_map = {}

    for s in steps:
        try:
            i = int(s.get("stepNumber"))
        except Exception:
            continue

        if i < 1 or i > 7:
            continue

        title = (s.get("title") or "").strip()
        content = (s.get("content") or "").strip()

        # Cap very long content to reduce token waste / errors
        if len(content) > 6000:
            content = content[:6000] + "\n...[TRUNCATED]..."

        step_map[i] = title
        content_map[i] = content

    def step_text(i: int) -> str:
        title = step_map.get(i, f"Step {i}")
        content = content_map.get(i, "").strip()

        # Force consistent missing text in the input itself
        if not content:
            content = missing_text

        return f"Step {i} – {title}:\n{content}\n"

    steps_block = "\n".join(step_text(i) for i in range(1, 8))

    if lang == "ar":
        instructions = """
أنت مساعد أكاديمي.
مهمتك: إنشاء تقرير مُلخّص ومنظّم بناءً على نصوص الطالب في 7 خطوات.

قواعد صارمة:
- لخص فقط المعلومات الموجودة في النص. ممنوع إضافة أفكار جديدة أو افتراضات.
- إذا كانت خطوة فارغة أو غير موجودة اكتب: "لم يتم تزويد هذه الخطوة من قبل الطالب."
- اكتب باللغة العربية الفصحى، بأسلوب أكاديمي واضح ومختصر.
- الناتج يجب أن يكون Markdown بعناوين ثابتة كما يلي (بنفس الترتيب):

## 1. نظرة عامة على المشروع
## 2. مشكلة البحث
## 3. الأهداف
## 4. المنهجية
## 5. الأدوات والتقنيات
## 6. الجدول الزمني والمعالم
## 7. النتائج المتوقعة
## ملخص عام
"""
    else:
        instructions = """
You are an academic assistant.
Task: Create a structured summary report based ONLY on the student's text across 7 steps.

Strict rules:
- Summarize ONLY what exists in the input. Do NOT invent, assume, or add new information.
- If a step is missing/empty, write: "Not provided by the student."
- Use a formal academic tone, clear and concise.
- Output MUST be Markdown with EXACT headings (same order):

## 1. Project Overview
## 2. Problem Statement
## 3. Objectives
## 4. Methodology
## 5. Tools & Technologies
## 6. Timeline & Milestones
## 7. Expected Outcomes
## Overall Summary
"""

    return f"{instructions}\n\nINPUT STEPS:\n{steps_block}"


def call_groq_report(
    client: Groq,
    model: str,
    steps: List[Dict[str, Any]],
    language: str = "en",
) -> str:
    prompt = build_prompt(steps, language)

    completion = client.chat.completions.create(
        model=model,
        temperature=0.3,
        max_tokens=1200,
        messages=[
            {"role": "system", "content": "Follow instructions strictly."},
            {"role": "user", "content": prompt},
        ],
    )

    text = completion.choices[0].message.content or ""
    return text.strip()
