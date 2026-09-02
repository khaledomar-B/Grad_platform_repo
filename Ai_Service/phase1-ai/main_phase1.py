#main.py
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import json

from schemas import Phase1ChecklistInput, AISuggestionRequest, AISuggestionResponse
from phase1 import evaluate
from ai_groq import suggest
import repo_db  # <-- Khaled will replace internals, not the import

app = FastAPI(title="Phase 1 Checklist API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/phase1/criteria")
def list_criteria():
    criteria = repo_db.get_phase1_criteria()
    return {"count": len(criteria), "criteria": criteria}

@app.post("/phase1/checklist/run")
def run_checklist(payload: Phase1ChecklistInput):
    criteria = repo_db.get_phase1_criteria()
    if not criteria:
        raise HTTPException(500, "No criteria found for Phase 1.")

    total_score, passed, results = evaluate(criteria, payload.model_dump())

    run_id = repo_db.create_phase1_run(payload.project_id, total_score, passed)
    repo_db.save_phase1_results(run_id, results)

    return {
        "run_id": run_id,
        "project_id": payload.project_id,
        "total_score": total_score,
        "passed": passed,
        "results": results
    }

@app.post("/phase1/ai/suggest", response_model=AISuggestionResponse)
def ai_help(payload: AISuggestionRequest):
    try:
        data = suggest(payload.model_dump())
        explanation = (data.get("explanation") or "").strip()
        suggested_text = (data.get("suggested_text") or payload.student_text).strip()
        tips = data.get("tips") if isinstance(data.get("tips"), list) else []

        if not tips:
            tips = ["نظم النص كنقاط قصيرة واذكر تفاصيل محددة."]

        return AISuggestionResponse(
            criterion_id=payload.criterion_id,
            original_text=payload.student_text,
            explanation=explanation or "تم تقديم ملاحظات وتحسين للنص.",
            suggested_text=suggested_text,
            tips=tips
        )
    except json.JSONDecodeError:
        return AISuggestionResponse(
            criterion_id=payload.criterion_id,
            original_text=payload.student_text,
            explanation="AI returned invalid JSON. Try again.",
            suggested_text=payload.student_text,
            tips=["Try again."]
        )
    except Exception as e:
        return AISuggestionResponse(
            criterion_id=payload.criterion_id,
            original_text=payload.student_text,
            explanation=f"AI error: {e}",
            suggested_text=payload.student_text,
            tips=["عدّل النص يدويًا بناءً على وصف المعيار."]
        )
