---
phase: frontend-integration
plan: '10'
type: execute
wave: 3
depends_on:
  - frontend-integration-06
  - frontend-integration-08
files_modified:
  - ml-service/app.py
  - ml-service/model/trainer.py
  - ml-service/requirements.txt
  - ml-service/Dockerfile
  - backend/src/services/ml.service.js
  - backend/src/modules/ml/ml.controller.js
  - backend/src/modules/ml/ml.routes.js
autonomous: true
user_setup:
  - service: python
    why: "ML service requires Python with scikit-learn"
    env_vars:
      - name: ML_SERVICE_PORT
        value: "5000"
    dashboard_config: []

must_haves:
  truths:
    - ML service trains RandomForest classifier
    - Features include: time complexity, space complexity, test cases passed, difficulty, time to solve
    - Model predicts winner based on submission features
    - API endpoint accepts features, returns prediction with confidence
    - Model version tracked for reproducibility
    - Prediction saved to competition history
  artifacts:
    - path: ml-service/app.py
      provides: Flask API for ML predictions
      min_lines: 60
    - path: ml-service/model/trainer.py
      provides: RandomForest model training
      min_lines: 80
    - path: backend/src/services/ml.service.js
      provides: Node.js client for ML service
      min_lines: 50
  key_links:
    - from: ml.service.js
      to: ml-service/app.py
      via: HTTP POST /predict
      pattern: axios.post('http://ml-service:5000/predict', features)
    - from: ml.controller.js
      to: ml.service.js
      via: Service method call
      pattern: mlService.predictWinner(features)
---

<objective>
Build ML service using RandomForest to predict competition winner based on code quality metrics and performance.

Purpose: Fairly determine winner using multiple factors (complexity, test cases, time) rather than just first to solve.

Output: Python ML service with RandomForest, training pipeline, prediction API, Node.js integration.
</objective>

<execution_context>
@C:/Users/HP/.config/opencode/get-shit-done/workflows/execute-plan.md
@C:/Users/HP/.config/opencode/get-shit-done/templates/summary.md
</execution_context>

<context>
@E:/Projects/DevWars/backend/src/services
@E:/Projects/DevWars/backend/src/modules
</context>

<tasks>

<task type="auto">
  <name>Create ML service structure and dependencies</name>
  <files>ml-service/requirements.txt, ml-service/Dockerfile, ml-service/app.py</files>
  <action>
    Set up ML service project:
    
    1. Directory structure:
       ml-service/
       ├── app.py              # Flask API
       ├── requirements.txt    # Dependencies
       ├── Dockerfile          # Container config
       ├── model/
       │   ├── trainer.py      # Model training
       │   ├── predictor.py    # Prediction logic
       │   └── model.pkl       # Serialized model
       └── data/
           └── training.csv    # Training data
    
    2. requirements.txt:
       - flask==2.3.3
       - scikit-learn==1.3.0
       - pandas==2.0.3
       - numpy==1.24.3
       - gunicorn==21.2.0
    
    3. Dockerfile:
       - Base: python:3.11-slim
       - Install gcc for scikit-learn compilation
       - Copy requirements, install
       - Copy model code
       - Run: gunicorn -b 0.0.0.0:5000 app:app
    
    4. app.py skeleton:
       - Flask app with CORS
       - Health check endpoint: GET /health
       - Prediction endpoint: POST /predict
       - Training endpoint: POST /train (admin only)
    
    Add to docker-compose.yml for orchestration.
  </action>
  <verify>ML service structure created, requirements defined</verify>
  <done>ML service project structure with Flask and scikit-learn</done>
</task>

<task type="auto">
  <name>Implement RandomForest model training</name>
  <files>ml-service/model/trainer.py</files>
  <action>
    Create model training module:
    
    1. Feature definitions:
       - time_complexity_score: numeric (1-5, lower is better)
         - O(1) = 5, O(log n) = 4, O(n) = 3, O(n log n) = 2, O(n²) = 1
       - space_complexity_score: numeric (1-5, same mapping)
       - test_cases_passed: numeric (0-2)
       - constraint_difficulty: numeric (1-5, based on problem difficulty)
       - time_to_solve: numeric (seconds, normalized)
    
    2. Training data (initial synthetic dataset):
       ```python
       data = pd.DataFrame({
           "time_complexity_score": [5, 3, 5, 2, 4, 3, 5, 2],
           "space_complexity_score": [5, 4, 4, 3, 5, 3, 4, 2],
           "test_cases_passed": [2, 1, 2, 2, 2, 1, 2, 1],
           "constraint_difficulty": [3, 3, 4, 4, 3, 2, 5, 3],
           "time_to_solve": [300, 500, 250, 600, 350, 550, 280, 700],
           "winner": [1, 0, 1, 0, 1, 0, 1, 0]
       })
       ```
    
    3. Model training:
       - RandomForestClassifier(n_estimators=100, random_state=42)
       - Split: 80% train, 20% test
       - Metrics: accuracy, precision, recall
       - Save model to model.pkl using joblib
    
    4. Methods:
       - train_model(data_path): Train and save model
       - load_model(): Load model from disk
       - get_feature_importance(): Return feature weights
    
    5. Model versioning:
       - Save with timestamp: model_YYYYMMDD_HHMMSS.pkl
       - Store current version in version.txt
  </action>
  <verify>Model trains successfully, achieves >80% accuracy on test set</verify>
  <done>RandomForest model trained with feature importance</done>
</task>

<task type="auto">
  <name>Create prediction API and service integration</name>
  <files>ml-service/model/predictor.py, ml-service/app.py</files>
  <action>
    Create prediction logic and Flask endpoints:
    
    1. predictor.py:
       - load_model(path): Load serialized model
       - predict(features: dict) -> dict:
         ```python
         {
           "predicted_winner": 0 or 1,  # 0 = player1, 1 = player2
           "confidence": 0.85,  # max probability
           "probabilities": [0.15, 0.85],  # class probabilities
           "feature_importance": {
             "test_cases_passed": 0.45,
             "time_complexity": 0.30,
             ...
           }
         }
         ```
       - normalize_features(raw_features): Convert to model input format
       - validate_features(features): Check all required fields present
    
    2. Flask endpoints:
       - POST /predict
         Body: {
           "player1": { "time_complexity_score", "space_complexity_score", "test_cases_passed", "constraint_difficulty", "time_to_solve" },
           "player2": { same fields }
         }
         Response: {
           "success": true,
           "data": {
             "winner": "player1" or "player2",
             "confidence": 0.85,
             "reasoning": { feature contributions }
           }
         }
       
       - GET /health
         Response: { "status": "healthy", "model_version": "20240218_120000" }
       
       - POST /train (admin)
         Body: { "data_path": "/data/training.csv" }
         Retrains model with new data
    
    3. Error handling:
       - 400: Invalid features
       - 500: Model not loaded
       - Return descriptive error messages
  </action>
  <verify>API accepts features, returns prediction with confidence</verify>
  <done>Prediction API with feature validation and confidence scores</done>
</task>

<task type="auto">
  <name>Create Node.js ML service client</name>
  <files>backend/src/services/ml.service.js, backend/src/modules/ml/ml.controller.js, backend/src/modules/ml/ml.routes.js</files>
  <action>
    Create backend integration with ML service:
    
    1. ml.service.js:
       - predictWinner(player1Features, player2Features):
         - Call ML service POST /predict
         - Return winner prediction
       - getHealth(): Check ML service status
       - convertSubmissionToFeatures(submission, problem):
         - Map timeComplexity string to score (O(1)→5, O(n)→3, etc.)
         - Map spaceComplexity string to score
         - Calculate normalized timeToSolve
         - Return feature object
    
    2. ml.controller.js:
       - POST /api/v1/ml/predict-winner
         Body: { roomId }
         - Fetch room submissions
         - Convert to features
         - Call mlService.predictWinner()
         - Save prediction to CompetitionHistory
         - Return prediction result
       
       - GET /api/v1/ml/health
         - Return ML service health status
    
    3. ml.routes.js:
       - Register routes
       - Add admin middleware for retrain endpoint
    
    4. Integration with match end flow:
       - When match ends, automatically call predict-winner
       - Store winner in room.winner
       - Update CompetitionHistory with ML prediction
  </action>
  <verify>Backend calls ML service, returns predictions, stores results</verify>
  <done>Node.js ML client integrated with competition flow</done>
</task>

</tasks>

<verification>
- ML service starts and responds to /health
- Model trains with >80% accuracy
- POST /predict returns winner with confidence
- Features are normalized correctly
- Backend can call ML service
- Prediction saved to CompetitionHistory
- Model version tracked
</verification>

<success_criteria>
ML service uses RandomForest to predict winner based on time complexity, space complexity, test cases passed, difficulty, and solve time. API returns prediction with confidence score and reasoning.
</success_criteria>

<output>
After completion, create `.planning/phases/frontend-integration/frontend-integration-10-SUMMARY.md`
</output>
