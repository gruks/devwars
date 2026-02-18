---
phase: frontend-integration
plan: '10'
type: execute
wave: 3
depends_on:
  - frontend-integration-06
  - frontend-integration-08
files_modified:
  - ml-service/main.py
  - ml-service/model/trainer.py
  - ml-service/model/predictor.py
  - ml-service/requirements.txt
  - ml-service/Dockerfile
  - ml-service/docker-compose.yml
  - backend/src/services/ml.service.js
  - backend/src/modules/ml/ml.controller.js
  - backend/src/modules/ml/ml.routes.js
autonomous: true
user_setup:
  - service: python
    why: "ML service requires Python 3.11+ with scikit-learn"
    env_vars:
      - name: ML_SERVICE_PORT
        value: "5000"
      - name: MODEL_PATH
        value: "./models/winner_predictor.pkl"
    dashboard_config: []

must_haves:
  truths:
    - ML service is FastAPI-based with async endpoints
    - RandomForest classifier trained with scikit-learn
    - Features include: time complexity score, space complexity score, test cases passed, constraint difficulty, time to solve
    - POST /predict accepts player features, returns prediction with confidence and feature importance
    - Model version tracked in version.txt with timestamp
    - Health check endpoint at GET /health returns model status
    - Model auto-loads on startup from serialized joblib file
    - Prediction saved to CompetitionHistory.mlPrediction field
  artifacts:
    - path: ml-service/main.py
      provides: FastAPI application with /predict and /health endpoints
      min_lines: 80
      exports: ["app", "predict_winner", "health_check"]
    - path: ml-service/model/trainer.py
      provides: RandomForest training with feature importance
      min_lines: 100
    - path: ml-service/model/predictor.py
      provides: Prediction logic with feature validation
      min_lines: 60
    - path: ml-service/requirements.txt
      provides: Python dependencies
      contains: ["fastapi", "uvicorn", "scikit-learn", "joblib", "pydantic", "numpy"]
    - path: backend/src/services/ml.service.js
      provides: Node.js client for ML service
      min_lines: 60
  key_links:
    - from: ml.service.js
      to: ml-service/main.py
      via: HTTP POST http://ml-service:5000/predict
      pattern: axios.post('http://ml-service:5000/predict', { player1, player2 })
    - from: ml.controller.js
      to: ml.service.js
      via: Service method call
      pattern: mlService.predictWinner(player1Features, player2Features)
    - from: trainer.py
      to: predictor.py
      via: Shared model.pkl file
      pattern: joblib.dump() / joblib.load()
---

<objective>
Build ML prediction service using FastAPI and RandomForest to predict competition winner based on code quality metrics and performance.

Purpose: Fairly determine winner using multiple factors (complexity, test cases, time) rather than just first to solve.

Output: FastAPI ML service with RandomForest, training pipeline, prediction API, Node.js integration per RESEARCH.md Pattern 4.
</objective>

<execution_context>
@C:/Users/HP/.config/opencode/get-shit-done/workflows/execute-plan.md
@C:/Users/HP/.config/opencode/get-shit-done/templates/summary.md
</execution_context>

<context>
@E:/Projects/DevWars/.planning/phases/frontend-integration/frontend-integration-RESEARCH.md
@E:/Projects/DevWars/backend/src/services
@E:/Projects/DevWars/backend/src/modules
</context>

<tasks>

<task type="auto">
  <name>Create FastAPI ML service structure and dependencies</name>
  <files>ml-service/requirements.txt, ml-service/Dockerfile, ml-service/main.py, ml-service/docker-compose.yml</files>
  <action>
    Set up ML service project using FastAPI (per RESEARCH.md Pattern 4):
    
    1. Directory structure:
       ml-service/
       ├── main.py              # FastAPI application
       ├── requirements.txt     # Dependencies
       ├── Dockerfile           # Container config
       ├── docker-compose.yml   # Service orchestration
       ├── model/
       │   ├── trainer.py       # Model training
       │   ├── predictor.py     # Prediction logic
       │   └── winner_predictor.pkl  # Serialized model
       └── data/
           └── training.csv     # Training data
    
    2. requirements.txt (from RESEARCH.md):
       fastapi==0.115.0
       uvicorn==0.32.0
       scikit-learn==1.5.0
       joblib==1.4.0
       pydantic==2.9.0
       numpy==1.26.0
       pandas==2.2.0
    
    3. Dockerfile:
       - Base: python:3.11-slim
       - Install gcc for scikit-learn compilation
       - WORKDIR /app
       - COPY requirements.txt .
       - RUN pip install --no-cache-dir -r requirements.txt
       - COPY . .
       - EXPOSE 5000
       - CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "5000"]
    
    4. main.py skeleton (FastAPI per RESEARCH.md):
       ```python
       from fastapi import FastAPI, HTTPException
       from pydantic import BaseModel
       from typing import List, Optional
       import joblib
       import numpy as np
       from contextlib import asynccontextmanager
       
       app = FastAPI(title="DevWars Prediction Service")
       
       @asynccontextmanager
       async def lifespan(app: FastAPI):
           # Startup: Load model
           load_model()
           yield
           # Shutdown: Cleanup
       
       app = FastAPI(title="DevWars Prediction Service", lifespan=lifespan)
       
       @app.get("/health")
       async def health_check():
           return {"status": "healthy", "model_loaded": model is not None}
       
       @app.post("/predict")
       async def predict_winner(features: MatchFeatures):
           # Implementation in next task
           pass
       ```
    
    5. docker-compose.yml:
       Add ml-service to existing compose:
       ```yaml
       ml-service:
         build:
           context: ./ml-service
           dockerfile: Dockerfile
         ports:
           - "5000:5000"
         volumes:
           - ./ml-service/models:/app/models
         environment:
           - MODEL_PATH=/app/models/winner_predictor.pkl
         networks:
           - devwars-network
       ```
  </action>
  <verify>Dockerfile builds successfully, FastAPI app starts with uvicorn</verify>
  <done>FastAPI ML service structure with async support and auto-docs</done>
</task>

<task type="auto">
  <name>Implement RandomForest model training with scikit-learn</name>
  <files>ml-service/model/trainer.py, ml-service/models/version.txt</files>
  <action>
    Create model training module per RESEARCH.md Pattern 4:
    
    1. Feature definitions (per RESEARCH.md):
       - time_complexity_score: numeric (1-5, mapped from big-O)
         - O(1) = 5, O(log n) = 4, O(n) = 3, O(n log n) = 2, O(n²) = 1, O(n³) = 0
       - space_complexity_score: numeric (1-5, same mapping as time)
       - test_cases_passed: numeric (0-2)
       - constraint_difficulty: numeric (1-5, problem difficulty rating)
       - time_to_solve: numeric (seconds, will be normalized)
    
    2. Training data (initial synthetic dataset from RESEARCH.md):
       ```python
       import pandas as pd
       import numpy as np
       from sklearn.ensemble import RandomForestClassifier
       from sklearn.model_selection import train_test_split
       from sklearn.metrics import accuracy_score, precision_score, recall_score
       import joblib
       from datetime import datetime
       
       def create_initial_training_data():
           """Create initial synthetic training data"""
           data = pd.DataFrame({
               "time_complexity_score": [5, 3, 5, 2, 4, 3, 5, 2, 4, 5, 3, 4],
               "space_complexity_score": [5, 4, 4, 3, 5, 3, 4, 2, 4, 5, 3, 4],
               "test_cases_passed": [2, 1, 2, 2, 2, 1, 2, 1, 2, 2, 1, 2],
               "constraint_difficulty": [3, 3, 4, 4, 3, 2, 5, 3, 4, 3, 3, 4],
               "time_to_solve": [300, 500, 250, 600, 350, 550, 280, 700, 400, 320, 580, 380],
               "winner": [1, 0, 1, 0, 1, 0, 1, 0, 1, 1, 0, 1]
           })
           return data
       ```
    
    3. Model training with scikit-learn:
       ```python
       def train_model(data: pd.DataFrame = None, model_path: str = "./models/winner_predictor.pkl"):
           """Train RandomForest model and save to disk"""
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
           
           # Save model with timestamp versioning
           timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
           versioned_path = f"./models/winner_predictor_{timestamp}.pkl"
           joblib.dump(model, versioned_path)
           joblib.dump(model, model_path)  # Current version
           
           # Save version info
           with open("./models/version.txt", "w") as f:
               f.write(f"{timestamp}\n")
               f.write(f"accuracy:{accuracy:.4f}\n")
               f.write(f"features:{','.join(feature_columns)}\n")
           
           return model, {
               "accuracy": accuracy,
               "precision": precision,
               "recall": recall,
               "feature_importance": dict(zip(feature_columns, model.feature_importances_.tolist()))
           }
       ```
    
    4. Feature importance export:
       ```python
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
       ```
    
    5. Run training on module import if called directly:
       ```python
       if __name__ == "__main__":
           import os
           os.makedirs("./models", exist_ok=True)
           model, metrics = train_model()
           print(f"Feature importance: {metrics['feature_importance']}")
       ```
  </action>
  <verify>python ml-service/model/trainer.py runs successfully, achieves >80% accuracy, creates model.pkl</verify>
  <done>RandomForest model trained with scikit-learn, versioned, and feature importance tracked</done>
</task>

<task type="auto">
  <name>Create FastAPI prediction endpoint with Pydantic models</name>
  <files>ml-service/main.py, ml-service/model/predictor.py</files>
  <action>
    Create FastAPI prediction endpoint per RESEARCH.md Pattern 4 with Pydantic validation:
    
    1. predictor.py (prediction logic):
       ```python
       import joblib
       import numpy as np
       from typing import Dict, List, Optional
       import os
       
       MODEL_PATH = os.getenv("MODEL_PATH", "./models/winner_predictor.pkl")
       model = None
       
       def load_model():
           """Load model on startup"""
           global model
           try:
               model = joblib.load(MODEL_PATH)
               print(f"Model loaded from {MODEL_PATH}")
           except FileNotFoundError:
               # Train initial model if not exists
               from .trainer import train_model
               model, _ = train_model()
           return model
       
       def get_model_version():
           """Get current model version from version.txt"""
           try:
               with open("./models/version.txt", "r") as f:
                   return f.readline().strip()
           except FileNotFoundError:
               return "unknown"
       
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
       ```
    
    2. main.py (FastAPI app per RESEARCH.md):
       ```python
       from fastapi import FastAPI, HTTPException
       from pydantic import BaseModel, Field
       from typing import Dict, Literal
       from contextlib import asynccontextmanager
       from .model.predictor import load_model, predict_winner, get_model_version, model
       
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
       
       @app.get("/health")
       async def health_check():
           """Health check endpoint"""
           return {
               "status": "healthy",
               "model_loaded": model is not None,
               "model_version": get_model_version()
           }
       
       @app.post("/predict", response_model=PredictionResponse)
       async def predict_endpoint(features: MatchFeatures):
           """Predict winner based on player features"""
           if model is None:
               raise HTTPException(status_code=503, detail="Model not loaded")
           
           try:
               result = predict_winner(
                   player1_features=features.player1.model_dump(),
                   player2_features=features.player2.model_dump()
               )
               return result
           except Exception as e:
               raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")
       
       @app.get("/")
       async def root():
           return {
               "service": "DevWars Prediction Service",
               "version": "1.0.0",
               "endpoints": ["/health", "/predict"]
           }
       ```
    
    3. Auto-generated docs available at:
       - GET /docs - Swagger UI (interactive)
       - GET /redoc - ReDoc documentation
       - GET /openapi.json - OpenAPI schema
    
    4. Error handling per RESEARCH.md:
       - 400: Pydantic validation error (invalid features)
       - 503: Model not loaded (service not ready)
       - 500: Internal prediction error
  </action>
  <verify>uvicorn main:app --reload starts, /docs shows Swagger UI, /predict returns prediction with confidence</verify>
  <done>FastAPI prediction endpoint with Pydantic validation, auto-docs, and async support</done>
</task>

<task type="auto">
  <name>Create Node.js ML service client for FastAPI backend</name>
  <files>backend/src/services/ml.service.js, backend/src/modules/ml/ml.controller.js, backend/src/modules/ml/ml.routes.js</files>
  <action>
    Create backend integration with FastAPI ML service per RESEARCH.md Pattern 4:
    
    1. ml.service.js (axios client):
       ```javascript
       const axios = require('axios');
       
       const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://ml-service:5000';
       
       const mlApi = axios.create({
         baseURL: ML_SERVICE_URL,
         timeout: 5000,
         headers: { 'Content-Type': 'application/json' }
       });
       
       // Complexity string to score mapping per RESEARCH.md
       const complexityScores = {
         'O(1)': 5,
         'O(log n)': 4,
         'O(n)': 3,
         'O(n log n)': 2,
         'O(n^2)': 1,
         'O(n²)': 1,
         'O(n^3)': 0,
         'O(2^n)': 0,
         'O(n!)': 0
       };
       
       function parseComplexity(complexityString) {
         if (!complexityString) return 3; // Default to O(n)
         const score = complexityScores[complexityString.trim()];
         return score !== undefined ? score : 3;
       }
       
       class MLService {
         async predictWinner(player1Features, player2Features) {
           try {
             const response = await mlApi.post('/predict', {
               player1: player1Features,
               player2: player2Features
             });
             return {
               success: true,
               data: response.data
             };
           } catch (error) {
             console.error('ML service prediction error:', error.message);
             return {
               success: false,
               error: error.response?.data?.detail || error.message
             };
           }
         }
         
         async getHealth() {
           try {
             const response = await mlApi.get('/health');
             return {
               success: true,
               data: response.data
             };
           } catch (error) {
             return {
               success: false,
               error: error.message
             };
           }
         }
         
         convertSubmissionToFeatures(submission, problem) {
           // Map submission data to ML features per RESEARCH.md
           return {
             time_complexity_score: parseComplexity(submission.timeComplexity),
             space_complexity_score: parseComplexity(submission.spaceComplexity),
             test_cases_passed: submission.passedTestCases || 0,
             constraint_difficulty: problem.difficultyRating || 3, // 1-5
             time_to_solve: submission.timeToSolve || 0
           };
         }
       }
       
       module.exports = new MLService();
       ```
    
    2. ml.controller.js:
       ```javascript
       const mlService = require('../../services/ml.service');
       const Room = require('../../modules/rooms/room.model');
       const CompetitionHistory = require('../../modules/competition/competitionHistory.model');
       
       exports.predictWinner = async (req, res) => {
         try {
           const { roomId } = req.body;
           
           // Fetch room with submissions
           const room = await Room.findById(roomId)
             .populate('participants', 'username')
             .populate('problemId');
           
           if (!room) {
             return res.status(404).json({ success: false, error: 'Room not found' });
           }
           
           // Get both player submissions
           const submissions = room.submissions || [];
           if (submissions.length < 2) {
             return res.status(400).json({ 
               success: false, 
               error: 'Need both player submissions to predict' 
             });
           }
           
           const player1Submission = submissions.find(s => 
             s.userId.toString() === room.participants[0]._id.toString()
           );
           const player2Submission = submissions.find(s => 
             s.userId.toString() === room.participants[1]._id.toString()
           );
           
           // Convert to features
           const player1Features = mlService.convertSubmissionToFeatures(
             player1Submission, 
             room.problemId
           );
           const player2Features = mlService.convertSubmissionToFeatures(
             player2Submission,
             room.problemId
           );
           
           // Get prediction from ML service
           const prediction = await mlService.predictWinner(
             player1Features,
             player2Features
           );
           
           if (!prediction.success) {
             return res.status(500).json(prediction);
           }
           
           // Save prediction to CompetitionHistory
           await CompetitionHistory.findOneAndUpdate(
             { roomId: room.roomId },
             {
               mlPrediction: {
                 predictedWinner: prediction.data.winner === 'player1' 
                   ? room.participants[0]._id 
                   : room.participants[1]._id,
                 confidence: prediction.data.confidence,
                 modelVersion: prediction.data.model_version,
                 featureImportance: prediction.data.feature_importance
               }
             }
           );
           
           res.json({
             success: true,
             data: prediction.data
           });
         } catch (error) {
           console.error('Predict winner error:', error);
           res.status(500).json({ 
             success: false, 
             error: error.message 
           });
         }
       };
       
       exports.getHealth = async (req, res) => {
         try {
           const health = await mlService.getHealth();
           res.json(health);
         } catch (error) {
           res.status(500).json({ 
             success: false, 
             error: error.message 
           });
         }
       };
       ```
    
    3. ml.routes.js:
       ```javascript
       const express = require('express');
       const router = express.Router();
       const mlController = require('./ml.controller');
       const { authenticate } = require('../../middleware/auth.middleware');
       
       router.get('/health', authenticate, mlController.getHealth);
       router.post('/predict-winner', authenticate, mlController.predictWinner);
       
       module.exports = router;
       ```
    
    4. Integration with match end flow (in match.service.js):
       ```javascript
       const mlService = require('./ml.service');
       
       async function endMatch(roomId) {
         // ... existing end match logic ...
         
         // Get ML prediction
         try {
           const submissions = room.submissions || [];
           if (submissions.length >= 2) {
             const player1Features = mlService.convertSubmissionToFeatures(
               submissions[0],
               room.problemId
             );
             const player2Features = mlService.convertSubmissionToFeatures(
               submissions[1],
               room.problemId
             );
             
             const prediction = await mlService.predictWinner(
               player1Features,
               player2Features
             );
             
             if (prediction.success) {
               room.mlPrediction = prediction.data;
               await room.save();
             }
           }
         } catch (error) {
           console.error('ML prediction failed:', error);
           // Don't fail match end if ML fails
         }
       }
       ```
    
    5. Environment variables:
       Add to backend .env:
       ```
       ML_SERVICE_URL=http://ml-service:5000
       ```
  </action>
  <verify>Backend calls FastAPI /predict, returns prediction with confidence and feature importance, saves to CompetitionHistory</verify>
  <done>Node.js ML client integrated with FastAPI service and competition flow</done>
</task>

</tasks>

<verification>
- ML service (FastAPI) starts and responds to GET /health with model status
- GET /docs shows Swagger UI with /predict endpoint documented
- Model trains with >80% accuracy using scikit-learn RandomForest
- POST /predict accepts Pydantic-validated features, returns winner with confidence and feature_importance
- Model auto-loads from joblib file on startup (or trains initial model if missing)
- Backend Node.js client successfully calls FastAPI /predict endpoint
- Prediction with confidence and model_version saved to CompetitionHistory.mlPrediction
- Model version tracked in version.txt with timestamp and accuracy
- Docker container builds and runs with uvicorn
</verification>

<success_criteria>
FastAPI ML service with scikit-learn RandomForest predicts competition winner based on time complexity, space complexity, test cases passed, difficulty, and solve time. Auto-generated OpenAPI docs at /docs. API returns prediction with confidence score, feature importance, and model version per RESEARCH.md Pattern 4.
</success_criteria>

<output>
After completion, create `.planning/phases/frontend-integration/frontend-integration-10-SUMMARY.md`
</output>
