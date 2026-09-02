# repo_db.py
# This file is intentionally written as a "repository interface".
# Jana will ship it with a TEMP in-memory implementation.
# Khaled will replace it with SQL Server implementation.

from datetime import datetime

# ---------- TEMP DATA (will be replaced by SQL Server) ----------
_PHASE1_CRITERIA = [
    {
        "criterion_id": 1,
        "title_ar": "عنوان المشروع ووصف مختصر موجودان",
        "title_en": "Project title and short description are provided",
        "description": "عنوان واضح ووصف موجز للفكرة.",
        "is_required": True,
        "max_score": 1,
        "check_type": "auto",
        "order_in_phase": 1,
    },
    {
        "criterion_id": 2,
        "title_ar": "المشكلة والحل المقترح مكتوبان بشكل واضح",
        "title_en": "Problem and solution are clear",
        "description": "توضيح المشكلة والحل.",
        "is_required": True,
        "max_score": 1,
        "check_type": "auto",
        "order_in_phase": 2,
    },
    {
        "criterion_id": 3,
        "title_ar": "الأهداف المتوقعة مكتملة وواضحة",
        "title_en": "Objectives are clear",
        "description": "أهداف محددة وقابلة للقياس.",
        "is_required": True,
        "max_score": 1,
        "check_type": "auto",
        "order_in_phase": 3,
    },
    {
        "criterion_id": 4,
        "title_ar": "التقنيات والأدوات المستخدمة محددة",
        "title_en": "Tools specified",
        "description": "ذكر أدوات وتقنيات.",
        "is_required": True,
        "max_score": 1,
        "check_type": "auto",
        "order_in_phase": 4,
    },
    {
        "criterion_id": 5,
        "title_ar": "الجدول الزمني المبدئي مرفق",
        "title_en": "Timeline provided",
        "description": "جدول زمني مبدئي.",
        "is_required": False,
        "max_score": 1,
        "check_type": "auto",
        "order_in_phase": 5,
    },
    # Example "new criterion" handled by AI-only:
    {
        "criterion_id": 6,
        "title_ar": "إضافة قسم المخاطر (Risks)",
        "title_en": "Risks section",
        "description": "اذكر المخاطر المحتملة وخطة التخفيف.",
        "is_required": False,
        "max_score": 0,
        "check_type": "ai",
        "order_in_phase": None,
    },
]

_RUNS = []
_RESULTS = []

# ---------- Repository functions (these are the contract) ----------
def get_phase1_criteria() -> list[dict]:
    return _PHASE1_CRITERIA

def create_phase1_run(project_id: int, total_score: float, passed: bool) -> int:
    run_id = len(_RUNS) + 1
    _RUNS.append({
        "run_id": run_id,
        "project_id": project_id,
        "run_datetime": datetime.utcnow().isoformat(),
        "total_score": total_score,
        "passed": passed
    })
    return run_id

def save_phase1_results(run_id: int, results: list[dict]) -> None:
    for r in results:
        _RESULTS.append({"run_id": run_id, **r})
