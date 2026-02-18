"""
Prediction logic for DevWars competition winner prediction.
Handles model loading and prediction with feature validation.
"""

import joblib
import numpy as np
from typing import Dict, Optional
import os

MODEL_PATH = os.getenv("MODEL_PATH", "./models/winner_predictor.pkl")
model = None


def load_model() -> Optional[object]:
    """Load model on startup or return existing model."""
    global model
    if model is not None:
        return model
    
    try:
        model = joblib.load(MODEL_PATH)
        print(f"Model loaded from {MODEL_PATH}")
    except FileNotFoundError:
        # Train initial model if not exists
        from .trainer import train_model
        print("No model found, training initial model...")
        model, _ = train_model()
    
    return model


def get_model_version() -> str:
    """Get current model version from version.txt"""
    try:
        version_path = MODEL_PATH.replace("winner_predictor.pkl", "version.txt")
        with open(version_path, "r") as f:
            return f.readline().strip()
    except FileNotFoundError:
        return "unknown"


def predict_winner(player1_features: dict, player2_features: dict) -> dict:
    """
    Predict winner based on relative feature comparison.
    
    Args:
        player1_features: Dict with keys time_complexity_score, space_complexity_score, 
                         test_cases_passed, constraint_difficulty, time_to_solve
        player2_features: Same structure as player1_features
        
    Returns:
        Dict with prediction, confidence, probabilities, feature_importance, model_version
    """
    global model
    if model is None:
        load_model()
    
    if model is None:
        raise RuntimeError("Model not loaded")

    feature_order = [
        "time_complexity_score",
        "space_complexity_score",
        "test_cases_passed",
        "constraint_difficulty",
        "time_to_solve"
    ]

    # Calculate feature differences (player1 - player2)
    # Positive values mean player1 has advantage
    feature_vector = np.array([[
        player1_features.get(f, 0) - player2_features.get(f, 0)
        for f in feature_order
    ]])

    # Get prediction and probabilities
    prediction = model.predict(feature_vector)[0]  # 0 = player2 wins, 1 = player1 wins
    probabilities = model.predict_proba(feature_vector)[0]

    # Get feature importance from model
    importance = dict(zip(feature_order, model.feature_importances_.tolist()))

    winner = "player1" if prediction == 1 else "player2"
    confidence = float(max(probabilities))

    return {
        "winner": winner,
        "confidence": confidence,
        "probabilities": {
            "player1": float(probabilities[1]),
            "player2": float(probabilities[0])
        },
        "feature_importance": importance,
        "model_version": get_model_version()
    }


def validate_features(features: dict) -> bool:
    """Validate that features contain all required fields."""
    required_fields = [
        "time_complexity_score",
        "space_complexity_score",
        "test_cases_passed",
        "constraint_difficulty",
        "time_to_solve"
    ]
    return all(field in features for field in required_fields)
