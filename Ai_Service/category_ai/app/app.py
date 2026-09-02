#app.py
from fastapi import FastAPI
from pydantic import BaseModel
from typing import Optional

from .predict import predict_category


app = FastAPI(title="Project Category Classifier")


class CategoryRequest(BaseModel):
    title: str
    description: str
    keywords: Optional[str] = ""


@app.post("/predict-category")
def predict(req: CategoryRequest):
    result = predict_category(req.title, req.description, req.keywords)
    return {
        "label": result["label"],
        "confidence_level": result["confidence_level"]
    }
    #uvicorn src.app:app --reload
