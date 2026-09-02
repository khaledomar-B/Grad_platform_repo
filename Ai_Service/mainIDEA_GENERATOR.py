'''
main.py--API & validation layer

This file handles everything related to the web API:
Defines the endpoint /generate-ideas
Validates user input (letters only, meaningful words, no gibberish)
Returns proper HTTP status codes (400, 503, etc.)
Protects the AI from bad input
Acts as the public interface of the service
'''

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional
import re

from idea_generator import generate_ideas

app = FastAPI(title="AI Idea Generator Service")


class IdeaRequest(BaseModel):
    major: str
    interests: str
    keywords: Optional[str] = None


MEANINGLESS_WORDS = {
    "what", "nothing", "yes", "no", "ok", "okay", "test", "asdf", "qwerty",
    "idk", "none", "null", "na", "n/a", "string"
}


ALLOWED_CHARS_PATTERN = re.compile(r"^[A-Za-z\u0600-\u06FF\s,.-]+$")

VOWELS_PATTERN = re.compile(r"[aeiouAEIOU]")


def normalize(s: Optional[str]) -> str:
    return (s or "").strip()


def is_only_allowed_chars(s: str) -> bool:
    return bool(ALLOWED_CHARS_PATTERN.match(s))


def is_meaningless_single_word(s: str) -> bool:
    return normalize(s).lower() in MEANINGLESS_WORDS


def looks_like_random_gibberish(s: str) -> bool:
    """
    Heuristic to catch random keyboard-smash like: kdhhadhifnfjwhshsj
    - One long token (no spaces)
    - Mostly consonants (very low vowels)
    - Not Arabic (Arabic doesn't use a/e/i/o/u the same way)
    """
    s = normalize(s)

    
    if re.search(r"[\u0600-\u06FF]", s):
        return False

    
    compact = re.sub(r"[\s,.-]+", "", s)

    
    if len(compact) >= 12 and " " not in s:
        vowels = len(VOWELS_PATTERN.findall(compact))
        ratio = vowels / max(len(compact), 1)
        if ratio < 0.20:  
            return True

    return False


def validate_field(name: str, value: str, optional: bool = False):
    value = normalize(value)

    if optional and value == "":
        return  

    
    if not optional and value == "":
        raise HTTPException(
            status_code=400,
            detail=f"{name} is required. Please enter valid words."
        )

    
    if not is_only_allowed_chars(value):
        raise HTTPException(
            status_code=400,
            detail="Please enter valid words (letters only). Avoid numbers or symbols."
        )

   
    if len(value) < 2:
        raise HTTPException(
            status_code=400,
            detail="Please enter meaningful values for major/interests/keywords."
        )

    
    if is_meaningless_single_word(value):
        raise HTTPException(
            status_code=400,
            detail="Please enter meaningful values for major/interests/keywords."
        )

    #
    if looks_like_random_gibberish(value):
        raise HTTPException(
            status_code=400,
            detail="Please enter meaningful values for major/interests/keywords."
        )


@app.post("/generate-ideas")
async def generate(req: IdeaRequest):
    major = normalize(req.major)
    interests = normalize(req.interests)
    keywords = normalize(req.keywords) if req.keywords is not None else ""

    
    validate_field("major", major)
    validate_field("interests", interests)
    validate_field("keywords", keywords, optional=True)

    # Call AI
    try:
        ideas = generate_ideas(major, interests, keywords if keywords else None)
        return {"ideas": ideas}
    except Exception:
        raise HTTPException(
            status_code=503,
            detail="AI service temporarily unavailable. Please try again later."
        )


