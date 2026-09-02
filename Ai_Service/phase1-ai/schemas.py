from pydantic import BaseModel
from typing import Optional, List

class Phase1ChecklistInput(BaseModel):
    project_id: int
    title_and_desc: str
    problem_and_solution: str
    objectives: str
    tools: str
    timeline: Optional[str] = ""

class AISuggestionRequest(BaseModel):
    criterion_id: int
    criterion_title: str
    criterion_description: str
    student_text: str
    rule_comment: Optional[str] = None
    language: str = "ar"
    type: str = "general"   

class AISuggestionResponse(BaseModel):
    criterion_id: int
    original_text: str
    explanation: str
    suggested_text: str
    tips: List[str]
