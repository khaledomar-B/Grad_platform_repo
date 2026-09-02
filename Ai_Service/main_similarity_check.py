import json
import re
from pathlib import Path
from typing import Optional
from collections import Counter

import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity

# ----------------------------
# Load projects
# ----------------------------
BASE_DIR = Path(__file__).resolve().parent
PROJECTS_FILE = BASE_DIR / "projects.json"

with PROJECTS_FILE.open("r", encoding="utf-8") as f:
    projects_data = json.load(f)

# Compare against: title + summary only (stable, matches your dataset)
project_texts = [
    f"{(p.get('title') or '').strip()} {(p.get('summary') or '').strip()}".strip()
    for p in projects_data
]

# ----------------------------
# Model + embeddings
# ----------------------------
model = SentenceTransformer("all-MiniLM-L6-v2")

project_embeddings = model.encode(
    project_texts,
    convert_to_numpy=True,
    normalize_embeddings=True,
)

# ----------------------------
# FastAPI app
# ----------------------------
app = FastAPI(title="Semantic Similarity Checker API")


class SimilarityRequest(BaseModel):
    text: str = ""
    title: Optional[str] = None
    summary: Optional[str] = None


class SimilarityResponse(BaseModel):
    similarity_percentage: float
    is_possible_duplicate: bool
    matched_project_id: Optional[int]
    matched_project_title: Optional[str]
    matched_project_summary: Optional[str]


# ----------------------------
# Validation helpers
# ----------------------------
def _collapse_spaces(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "")).strip()


def _has_any_letter(s: str) -> bool:
    # Works for English + Arabic + any Unicode letters
    return any(ch.isalpha() for ch in s)


def _extract_alpha_tokens(s: str) -> list[str]:
    """
    Extract "word-like" tokens that contain at least one letter.
    This avoids treating punctuation-joined text as one giant token.
    """
    return re.findall(r"[A-Za-z\u0600-\u06FF]+", s)


def _word_count_any_language(s: str) -> int:
    # Count words in a language-agnostic way (English + Arabic letters)
    return len(_extract_alpha_tokens(s))


def _looks_like_gibberish(s: str) -> bool:
    """
    Heuristics to catch:
      - repeated character spam: kkkkkkkkk, aaaaaa, كككككككك
      - long random consonant strings in English: kdhhadhifnfjwhshsj
    WITHOUT blocking real sentences that contain commas/punctuation.
    """
    s = _collapse_spaces(s)
    if not s:
        return True

    # Tokenize by letters (so commas/punctuation won't create fake long tokens)
    letter_tokens = _extract_alpha_tokens(s)
    letters_only = "".join(letter_tokens)

    # 1) repeated same character runs
    if re.search(r"(.)\1{6,}", letters_only):  # 7+ repeated chars
        return True

    # 2) extremely long "word" (now punctuation won't create a giant token)
    if letter_tokens and max(len(t) for t in letter_tokens) >= 45:
        return True

    # 3) English random strings: long ASCII token with no vowels
    vowels = set("aeiou")
    long_english = 0
    bad_english = 0
    for t in letter_tokens:
        if t.isascii() and len(t) >= 10:
            long_english += 1
            if not any(ch in vowels for ch in t.lower()):
                bad_english += 1
    if long_english >= 1 and (bad_english / long_english) >= 0.8:
        return True

    # 4) low variety of letters (mostly one letter repeated)
    if len(letters_only) >= 80:
        letters_lower=letters_only.lower()
        counts=Counter(letters_lower)
        most_common_ratio=counts.most_common(1)[0][1]/len(letters_lower)
        if most_common_ratio > 0.55:
            return True

    return False


def validate_meaningful_input(combined_text: str) -> None:
    combined_text = _collapse_spaces(combined_text)

    if not combined_text:
        raise HTTPException(
            status_code=422,
            detail="Please enter meaningful text in Title/Summary/Text.",
        )

    # Must contain at least one letter (reject numbers/symbols only)
    if not _has_any_letter(combined_text):
        raise HTTPException(
            status_code=422,
            detail="Please use words (letters). Numbers/symbols only are not allowed.",
        )

    alpha_tokens = _extract_alpha_tokens(combined_text)
    total_words = _word_count_any_language(combined_text)

    # Require: at least 3 alpha-words AND at least 5 total words
    # (this blocks: "cars", "hello", or too-short vague inputs)
    if len(alpha_tokens) < 3 or total_words < 5:
        raise HTTPException(
            status_code=422,
            detail="Please add more details (at least 5 words) or provide a clearer title (3+ words).",
        )

    # Gibberish check
    if _looks_like_gibberish(combined_text):
        raise HTTPException(
            status_code=422,
            detail="Please enter meaningful project title/summary/text (avoid random/repeated characters).",
        )


# ----------------------------
# Similarity logic
# ----------------------------
def compute_similarity(input_text: str) -> SimilarityResponse:
    input_text = _collapse_spaces(input_text)

    # Dynamic threshold: shorter text -> higher similarity required for "duplicate"
    word_count = _word_count_any_language(input_text)
    threshold = 0.88 if word_count < 12 else 0.80

    input_embedding = model.encode(
        [input_text],
        convert_to_numpy=True,
        normalize_embeddings=True,
    )

    sims = cosine_similarity(input_embedding, project_embeddings)[0]
    best_idx = int(np.argmax(sims))
    best_score = float(sims[best_idx])

    best_project = projects_data[best_idx]

    return SimilarityResponse(
        similarity_percentage=round(best_score * 100, 2),
        is_possible_duplicate=(best_score >= threshold),
        matched_project_id=best_project.get("id"),
        matched_project_title=best_project.get("title"),
        matched_project_summary=best_project.get("summary"),
    )


@app.post("/check-similarity", response_model=SimilarityResponse)
def check_similarity(payload: SimilarityRequest):
    # Combine fields (students might fill only title, only summary, etc.)
    combined = _collapse_spaces(
        f"{payload.title or ''} {payload.summary or ''} {payload.text or ''}"
    )

    # Validate BEFORE similarity
    validate_meaningful_input(combined)

    return compute_similarity(combined)


@app.get("/")
def root():
    return {"message": "Semantic Similarity Checker API running. See /docs to test."}

