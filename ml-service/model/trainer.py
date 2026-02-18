"""
RandomForest model trainer for DevWars competition winner prediction.
Trains a classifier to predict match winners based on code quality metrics.
"""

import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, precision_score, recall_score
import joblib
import os
from datetime import datetime


def create_initial_training_data():
    """Create initial synthetic training data based on RESEARCH.md patterns.
    
    Features:
    - time_complexity_score: numeric (1-5, mapped from big-O)
      O(1) = 5, O(log n) = 4, O(n) = 3, O(n log n) = 2, O(n²) = 1, O(n³) = 0
    - space_complexity_score: numeric (1-5, same mapping as time)
    - test_cases_passed: numeric (0-2)
    - constraint_difficulty: numeric (1-5, problem difficulty rating)
    - time_to_solve: numeric (seconds, will be normalized)
    """
    # Extended synthetic dataset for better training
    data = pd.DataFrame({
        "time_complexity_score": [
            5, 3, 5, 2, 4, 3, 5, 2, 4, 5, 3, 4,  # player 1 features
            5, 4, 3, 5, 2, 4, 3, 5, 4, 3, 5, 2   # player 2 features
        ],
        "space_complexity_score": [
            5, 4, 4, 3, 5, 3, 4, 2, 4, 5, 3, 4,  # player 1 features
            4, 5, 3, 4, 3, 5, 4, 3, 5, 4, 3, 4   # player 2 features
        ],
        "test_cases_passed": [
            2, 1, 2, 2, 2, 1, 2, 1, 2, 2, 1, 2,   # player 1 features
            1, 2, 2, 1, 2, 2, 1, 2, 2, 1, 2, 1   # player 2 features
        ],
        "constraint_difficulty": [
            3, 3, 4, 4, 3, 2, 5, 3, 4, 3, 3, 4,   # player 1 features
            4, 3, 3, 4, 4, 3, 2, 4, 3, 4, 3, 2   # player 2 features
        ],
        "time_to_solve": [
            300, 500, 250, 600, 350, 550, 280, 700, 400, 320, 580, 380,
            450, 280, 420, 350, 650, 320, 480, 360, 290, 520, 340, 620
        ],
        "winner": [
            1, 0, 1, 0, 1, 0, 1, 0, 1, 1, 0, 1,
            0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1
        ]
    })
    return data


def get_feature_importance(model) -> dict:
    """Return feature importance scores"""
    feature_names = [
        "time_complexity_score",
        "space_complexity_score",
        "test_cases_passed",
        "constraint_difficulty",
        "time_to_solve"
    ]
    return dict(zip(feature_names, model.feature_importances_.tolist()))


def train_model(data: pd.DataFrame = None, model_path: str = "./models/winner_predictor.pkl"):
    """Train RandomForest model and save to disk.
    
    Args:
        data: Training data DataFrame. If None, creates initial synthetic data.
        model_path: Path to save the trained model.
        
    Returns:
        Tuple of (model, metrics_dict)
    """
    if data is None:
        data = create_initial_training_data()
    
    feature_columns = [
        "time_complexity_score",
        "space_complexity_score",
        "test_cases_passed",
        "constraint_difficulty",
        "time_to_solve"
    ]
    
    X = data[feature_columns]
    y = data["winner"]
    
    # Split: 80% train, 20% test
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    
    # Train RandomForest
    model = RandomForestClassifier(
        n_estimators=100,
        max_depth=10,
        min_samples_split=2,
        random_state=42,
        n_jobs=-1
    )
    model.fit(X_train, y_train)
    
    # Evaluate
    y_pred = model.predict(X_test)
    accuracy = accuracy_score(y_test, y_pred)
    precision = precision_score(y_test, y_pred, zero_division=0)
    recall = recall_score(y_test, y_pred, zero_division=0)
    
    print(f"Model trained - Accuracy: {accuracy:.2f}, Precision: {precision:.2f}, Recall: {recall:.2f}")
    
    # Ensure models directory exists
    os.makedirs(os.path.dirname(model_path), exist_ok=True)
    
    # Save version info first
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    version_path = os.path.join(os.path.dirname(model_path), "version.txt")
    
    with open(version_path, "w") as f:
        f.write(f"{timestamp}\n")
        f.write(f"accuracy:{accuracy:.4f}\n")
        f.write(f"precision:{precision:.4f}\n")
        f.write(f"recall:{recall:.4f}\n")
        f.write(f"features:{','.join(feature_columns)}\n")
    
    # Save model
    joblib.dump(model, model_path)
    
    # Also save with timestamp version
    versioned_path = model_path.replace(".pkl", f"_{timestamp}.pkl")
    joblib.dump(model, versioned_path)
    
    print(f"Model saved to {model_path}")
    print(f"Version info saved to {version_path}")
    
    return model, {
        "accuracy": accuracy,
        "precision": precision,
        "recall": recall,
        "feature_importance": get_feature_importance(model),
        "timestamp": timestamp
    }


if __name__ == "__main__":
    model_path = os.getenv("MODEL_PATH", "./models/winner_predictor.pkl")
    os.makedirs("./models", exist_ok=True)
    model, metrics = train_model(model_path=model_path)
    print(f"Feature importance: {metrics['feature_importance']}")
    print(f"Model version: {metrics['timestamp']}")
