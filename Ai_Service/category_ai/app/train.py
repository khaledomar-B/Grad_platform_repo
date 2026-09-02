#train.py
import os
import pandas as pd
import joblib

from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix


BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_PATH = os.path.join(BASE_DIR, "data", "category_dataset_utf8.csv")
MODEL_DIR = os.path.join(BASE_DIR, "model")

MODEL_PATH = os.path.join(MODEL_DIR, "category_model.pkl")
VEC_PATH = os.path.join(MODEL_DIR, "tfidf_vectorizer.pkl")


def build_text(row: pd.Series) -> str:
    title = str(row.get("title", "")).strip()
    desc = str(row.get("description", "")).strip()
    return f"{title}. {desc}"



def main():
    # 1) Load dataset
    df = pd.read_csv(DATA_PATH, encoding="utf-8")


    # Basic cleanup
    df = df.dropna(subset=["title", "description", "label"])
    
    df["label"] = df["label"].astype(str).str.strip()

    df["text"] = df.apply(build_text, axis=1)
    X_train, X_test, y_train, y_test = train_test_split(
        df["text"],
        df["label"],
        test_size=0.2,
        random_state=42,
        stratify=df["label"]
    )

    
    pipeline = Pipeline([
        ("tfidf", TfidfVectorizer(
            lowercase=True,
            ngram_range=(1, 2),
            min_df=2,
            max_df=0.9,
            stop_words="english"
        )),
        ("clf", LogisticRegression(
            max_iter=2000,
            class_weight="balanced"  
        ))
    ])

    
    pipeline.fit(X_train, y_train)

    
    y_pred = pipeline.predict(X_test)
    acc = accuracy_score(y_test, y_pred)

    labels_sorted = sorted(df["label"].unique())
    cm = confusion_matrix(y_test, y_pred, labels=labels_sorted)

    print("\n=== Project Category Classifier Results ===")
    print(f"Dataset size: {len(df)}")
    print(f"Train size:   {len(X_train)}")
    print(f"Test size:    {len(X_test)}")
    print(f"Accuracy:     {acc:.4f}\n")

    print("Classification Report:")
    print(classification_report(y_test, y_pred))

    print("Confusion Matrix (rows=true, cols=pred):")
    print("Labels order:", labels_sorted)
    print(cm)
    print("=========================================\n")

    
    os.makedirs(MODEL_DIR, exist_ok=True)

    # pipeline steps
    tfidf = pipeline.named_steps["tfidf"]
    clf = pipeline.named_steps["clf"]

    joblib.dump(tfidf, VEC_PATH)
    joblib.dump(clf, MODEL_PATH)

    print(f"Saved TF-IDF vectorizer to: {VEC_PATH}")
    print(f"Saved classifier model to:  {MODEL_PATH}")


if __name__ == "__main__":
    main()
#python src/train.py
#.\.venv\Scripts\Activate.ps1
