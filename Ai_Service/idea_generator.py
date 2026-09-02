"""
idea_generator.py -- AI logic layer

This file handles everything related to AI:
- Builds the prompt
- Calls Groq
- Handles provider failure
- Parses JSON output
- Returns structured ideas
"""

import os
import json
from typing import List, Dict, Optional, Any

from dotenv import load_dotenv
from groq import Groq

load_dotenv()

api_key = os.getenv("GROQ_API_KEY")
if not api_key:
    raise RuntimeError(
        "GROQ_API_KEY not found. Make sure it is set correctly in the .env file."
    )

client = Groq(api_key=api_key)


def generate_ideas(
    major: str,
    interests: str,
    keywords: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Generates 5 graduation project ideas using Groq LLM.
    Each idea includes:
    - title
    - description
    - difficulty
    - recommended_tools
    """

    prompt = f"""
You are a helpful assistant that generates realistic graduation project ideas for university students.

Generate EXACTLY 5 project ideas for a student with:
- Major: "{major}"
- Interests: "{interests}"
- Keywords (optional): "{keywords or ""}"

Return the result as a pure JSON array of 5 objects.
Each object MUST have these fields:
- "title": a short title (max 6 words)
- "description": 1–2 sentences describing the project
- "difficulty": one of "Easy", "Medium", or "Hard"
- "recommended_tools": an array of 3–6 short strings

VERY IMPORTANT:
- Do NOT include any text before or after the JSON.
- Do NOT include comments or explanations.
Only output the JSON array.
"""

    # -----------------------------
    # Call Groq safely
    # -----------------------------
    try:
        completion = client.chat.completions.create(
            model="openai/gpt-oss-20b",
            messages=[
                {
                    "role": "system",
                    "content": "You are a concise assistant that only returns valid JSON when asked.",
                },
                {"role": "user", "content": prompt},
            ],
            max_tokens=1500,
            temperature=0.7,
        )
        raw_text = completion.choices[0].message.content

    except Exception:
        # Groq failed (rate limit, network error, model error, etc.)
        return [
            {
                "title": "AI Provider Unavailable",
                "description": "The AI provider is currently unavailable. Please try again later.",
                "difficulty": "Medium",
                "recommended_tools": ["FastAPI", "Groq API"],
            }
        ]

        # -----------------------------
    # Parse JSON safely
    # -----------------------------
    try:
        import re

        json_match = re.search(r"\[[\s\S]*\]", raw_text)

        if not json_match:
            raise ValueError("No JSON array found in AI response")

        ideas = json.loads(json_match.group())

        if isinstance(ideas, list) and all(isinstance(item, dict) for item in ideas):
            return ideas

        return [
            {
                "title": "Parsing Error",
                "description": "AI response did not match the expected structure.",
                "difficulty": "Easy",
                "recommended_tools": ["JSON"],
            }
        ]

    except Exception:
        return [
            {
                "title": "Non-JSON Response",
                "description": raw_text,
                "difficulty": "Easy",
                "recommended_tools": ["JSON"],
            }
        ]

