"""
File: main.py
Purpose:
This file defines the FastAPI application that exposes the
AI Summary Report service as a REST API.

What this file does:
- Loads configuration (Groq API key and model) from environment variables.
- Initializes the FastAPI application.
- Defines request and response data models using Pydantic.
- Exposes an API endpoint that receives project steps from the backend.
- Calls the AI logic to generate a summarized academic report.
- Returns the generated report in Markdown format.

Important design decision:
- This service does NOT access the database.
- All project data is provided by the backend (ASP.NET).
- This makes the AI service independent, modular, and easy to integrate.

Endpoints:
- GET /health : Used to check if the service is running.
- POST /ai/report/generate : Generates the summary report from provided steps.
"""

from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import List, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field, field_validator
from groq import Groq

from report_logic import call_groq_report



load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
# You already set this in .env to llama-3.1-8b-instant (good for speed)
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")

if not GROQ_API_KEY:
    raise RuntimeError("Missing GROQ_API_KEY in .env")

client = Groq(api_key=GROQ_API_KEY)

app = FastAPI(title="AI Summary Report Service", version="1.0.0")


class StepItem(BaseModel):
    stepNumber: int = Field(..., ge=1, le=7)
    title: Optional[str] = None
    content: Optional[str] = None


class ReportRequest(BaseModel):
    projectId: int
    steps: List[StepItem]
    language: str = Field(default="en", pattern="^(en|ar)$")

    @field_validator("steps")
    @classmethod
    def validate_steps_not_empty(cls, v):
        if not v:
            raise ValueError("steps cannot be empty")
        return v


class ReportResponse(BaseModel):
    projectId: int
    reportMarkdown: str
    generatedAt: str
    model: str


@app.get("/health")
def health():
    return {"status": "ok", "model": GROQ_MODEL}


@app.post("/ai/report/generate", response_model=ReportResponse)
def generate_report(req: ReportRequest):
    steps_payload = [s.model_dump() for s in req.steps]

    try:
        report_md = call_groq_report(
            client=client,
            model=GROQ_MODEL,
            steps=steps_payload,
            language=req.language,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI generation failed: {str(e)}")

    if not report_md:
        raise HTTPException(status_code=500, detail="AI returned empty output")

    # Basic format validation to avoid weird outputs during demo
    if req.language == "ar":
        required = [
            "## 1.", "## 2.", "## 3.", "## 4.", "## 5.", "## 6.", "## 7.", "## ملخص عام"
        ]
    else:
        required = [
            "## 1.", "## 2.", "## 3.", "## 4.", "## 5.", "## 6.", "## 7.", "## Overall Summary"
        ]

    if not all(h in report_md for h in required):
        raise HTTPException(
            status_code=500,
            detail="AI output missing required headings (invalid format)",
        )

    now = datetime.now(timezone.utc).isoformat()
    return ReportResponse(
        projectId=req.projectId,
        reportMarkdown=report_md,
        generatedAt=now,
        model=GROQ_MODEL,
    )
