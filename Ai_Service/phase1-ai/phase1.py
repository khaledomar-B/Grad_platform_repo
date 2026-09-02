#phase1.py
import re

def _count_objectives(text: str) -> int:
    parts = re.split(r"[\n؛;•\-]+", text)
    return len([p.strip() for p in parts if p.strip()])

def _count_tools(text: str) -> int:
    parts = re.split(r"[,،/]+", text)
    return len([p.strip() for p in parts if p.strip()])

def evaluate(criteria: list[dict], payload: dict):
    title_and_desc = payload["title_and_desc"].strip()
    problem_and_solution = payload["problem_and_solution"].strip()
    objectives = payload["objectives"].strip()
    tools = payload["tools"].strip()
    timeline = (payload.get("timeline") or "").strip()

    results = []
    total_score = 0
    required_failed = False

    for c in criteria:
        check_type = (c.get("check_type") or "auto").lower()
        order = c.get("order_in_phase")
        is_required = bool(c.get("is_required"))
        max_score = int(c.get("max_score") or 0)

        # ✅ NEW criteria added by supervisor → handled as AI-only
        if check_type == "ai":
            results.append({
                "criterion_id": c["criterion_id"],
                "status": "ai_only",
                "is_passed": None,
                "score": None,
                "comment": "بند جديد: لا يوجد تقييم آلي له، لكن يمكن الضغط على AI Help للحصول على اقتراحات."
            })
            continue

        # Auto criteria (orders 1..5 only)
        passed = False
        score = 0
        comment = None

        if order == 1:
            if not title_and_desc:
                comment = "العنوان والوصف فارغان."
            elif len(title_and_desc) < 20:
                comment = "العنوان والوصف قصيران جدًا."
            else:
                passed = True

        elif order == 2:
            if not problem_and_solution:
                comment = "المشكلة والحل غير مكتوبين."
            elif len(problem_and_solution) < 60:
                comment = "وصف المشكلة والحل قصير جدًا."
            else:
                passed = True

        elif order == 3:
            if not objectives:
                comment = "الأهداف غير مكتوبة."
            elif len(objectives) < 60:
                comment = "الأهداف قصيرة جدًا."
            elif _count_objectives(objectives) < 2:
                comment = "يجب كتابة هدفين على الأقل."
            else:
                passed = True

        elif order == 4:
            if not tools:
                comment = "لم يتم ذكر التقنيات."
            elif _count_tools(tools) < 2:
                comment = "يجب ذكر أداتين أو أكثر."
            else:
                passed = True

        elif order == 5:
            # optional
            if not timeline:
                comment = "اختياري ولم يتم تعبئته."
                passed = False
            elif len(timeline) < 20:
                comment = "الجدول الزمني قصير وغير واضح."
            else:
                passed = True

        else:
            # If something is misconfigured, don't crash
            results.append({
                "criterion_id": c["criterion_id"],
                "status": "manual",
                "is_passed": None,
                "score": None,
                "comment": "بند غير معروف للتقييم الآلي. يُفضل تحويله إلى AI أو تقييمه يدويًا."
            })
            continue

        if passed:
            score = max_score
            total_score += score
            status = "passed"
        else:
            status = "failed"

        # only required auto items (1..4) affect phase pass/fail
        if (not passed) and is_required and order in (1, 2, 3, 4):
            required_failed = True

        results.append({
            "criterion_id": c["criterion_id"],
            "status": status,
            "is_passed": passed,
            "score": score,
            "comment": comment
        })

    passed_all_required = not required_failed
    return total_score, passed_all_required, results
