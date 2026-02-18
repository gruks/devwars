from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import Dict, Literal, Optional
from contextlib import asynccontextmanager
import joblib
import numpy as np
import os

# Global model reference
model = None

MODEL_PATH = os.getenv("MODEL_PATH", "./models/winner_predictor.pkl")


def get_model_version() -> str:
    """Get current model version from version.txt"""
    try:
        version_path = MODEL_PATH.replace("winner_predictor.pkl", "version.txt")
        with open(version_path, "r") as f:
            return f.readline().strip()
    except FileNotFoundError:
        return "unknown"


def load_model():
    """Load model on startup"""
    global model
    try:
        model = joblib.load(MODEL_PATH)
        print(f"Model loaded from {MODEL_PATH}")
    except FileNotFoundError:
        print(f"Model not found at {MODEL_PATH}, will train on first prediction")
        model = None
    return model


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Load model
    load_model()
    yield
    # Shutdown: cleanup


app = FastAPI(
    title="DevWars Prediction Service",
    description="ML service for predicting competition winners using RandomForest",
    version="1.0.0",
    lifespan=lifespan
)


class PlayerFeatures(BaseModel):
    time_complexity_score: int = Field(..., ge=0, le=5, description="Time complexity score (0-5)")
    space_complexity_score: int = Field(..., ge=0, le=5, description="Space complexity score (0-5)")
    test_cases_passed: int = Field(..., ge=0, le=2, description="Number of test cases passed (0-2)")
    constraint_difficulty: int = Field(..., ge=1, le=5, description="Problem difficulty rating (1-5)")
    time_to_solve: int = Field(..., ge=0, description="Time to solve in seconds")


class MatchFeatures(BaseModel):
    player1: PlayerFeatures
    player2: PlayerFeatures


class PredictionResponse(BaseModel):
    winner: Literal["player1", "player2"]
    confidence: float = Field(..., ge=0, le=1)
    probabilities: Dict[str, float]
    feature_importance: Dict[str, float]
    model_version: str


@app.get("/")
async def root():
    return {
        "service": "DevWars Prediction Service",
        "version": "1.0.0",
        "endpoints": ["/health", "/predict"]
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "model_loaded": model is not None,
        "model_version": get_model_version()
    }


def predict_winner(player1_features: dict, player2_features: dict) -> dict:
    """
    Predict winner based on relative feature comparison.
    Returns dict with prediction, confidence, and feature importance.
    """
    global model
    if model is None:
        raise RuntimeError("Model not loaded")

    feature_order = [
        "time_complexity_score",
        "space_complexity_score",
        "test_cases_passed",
        "constraint_difficulty",
        "time_to_solve"
    ]

    # Calculate feature differences (relative advantage)
    feature_vector = np.array([[
        player1_features[f] - player2_features[f]
        for f in feature_order
    ]])

    # Get prediction and probabilities
    prediction = model.predict(feature_vector)[0]  # 0 = player2 wins, 1 = player1 wins
    probabilities = model.predict_proba(feature_vector)[0]

    # Get feature importance
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


@app.post("/predict", response_model=PredictionResponse)
async def predict_endpoint(features: MatchFeatures):
    """Predict winner based on player features"""
    if model is None:
        # Try to train initial model
        try:
            from model.trainer import train_model
            global model
            model, _ = train_model()
        except Exception as e:
            raise HTTPException(status_code=503, detail=f"Model not loaded: {str(e)}")

    try:
        result = predict_winner(
            player1_features=features.player1.model_dump(),
            player2_features=features.player2.model_dump()
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")
