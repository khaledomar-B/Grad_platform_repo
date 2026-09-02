#predict.py
import os
import joblib

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_DIR = os.path.join(BASE_DIR, "model")

MODEL_PATH = os.path.join(MODEL_DIR, "category_model.pkl")
VEC_PATH = os.path.join(MODEL_DIR, "tfidf_vectorizer.pkl")


def build_text(title: str, description: str, keywords: str = "") -> str:
    title = (title or "").strip()
    description = (description or "").strip()
    keywords = (keywords or "").strip()
    return f"{title}. {description}. Keywords: {keywords}"


def load_artifacts():
    vectorizer = joblib.load(VEC_PATH)
    model = joblib.load(MODEL_PATH)
    return vectorizer, model
def confidence_level(prob: float) -> str:
    if prob is None:
        return "Unknown"
    if prob >= 0.60:
        return "High"
    elif prob >= 0.40:
        return "Medium"
    else:
        return "Low"


def predict_category(title: str, description: str, keywords: str = "") -> dict:
    vectorizer, model = load_artifacts()

    text = build_text(title, description, keywords)
    X = vectorizer.transform([text])

    pred_label = model.predict(X)[0]

    # confidence
    if hasattr(model, "predict_proba"):
        proba = model.predict_proba(X)[0]
        classes = list(model.classes_)
        conf = float(proba[classes.index(pred_label)])
    else:
        conf = None

    return {
        "label": pred_label,
        "confidence": conf,
        "confidence_level": confidence_level(conf)
    }


if __name__ == "__main__":
    # quick manual test
    result = predict_category(
        title="Smart Home Energy Dashboard",
        description="A web system that shows energy usage and gives insights using sensors data.",
        keywords="dashboard,energy,monitoring"
    )
    print(result)
