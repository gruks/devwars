# Phase 0: Frontend Integration - Research

**Researched:** 2026-02-18
**Domain:** React Frontend Integration, Monaco Editor, WebSocket Sync, ML Prediction, MongoDB Schemas
**Confidence:** HIGH

## Summary

This research covers the implementation of Phase 0: Frontend Integration for the DevWars competitive coding platform. The goal is to connect the existing code-arena React frontend to backend APIs and build a LeetCode-style competitive coding room experience.

**Key Areas Researched:**
1. Monaco Editor integration for React (coding environment)
2. WebSocket room state synchronization strategies
3. ML prediction service architecture using RandomForest
4. MongoDB schema patterns for test cases, spectators, and match history
5. Docker sandbox integration from frontend perspective
6. Result modal UX patterns with animations
7. Competition history data modeling

**Primary Recommendation:** Use `@monaco-editor/react` v4.7+ for the editor, implement a Socket.io Context Provider pattern for real-time state, deploy ML service as a separate FastAPI microservice with scikit-learn, and follow MongoDB gaming industry patterns for schema design.

---

## Standard Stack

### Core Libraries

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @monaco-editor/react | 4.7.0+ | Code editor component | 3.2M weekly downloads, zero webpack config needed, React 19 support |
| socket.io-client | 4.8+ | WebSocket client | Official client, auto-reconnect, room support |
| scikit-learn | 1.5+ | ML prediction engine | Industry standard for RandomForest, production-ready |
| FastAPI | 0.115+ | ML service API | Fast, async, automatic OpenAPI docs |
| canvas-confetti | 1.9+ | Celebration animations | Lightweight, 2.4M weekly downloads, performant |
| mongoose | 8.0+ | MongoDB ODM | Schema validation, population, middleware |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-use | 17.5+ | Utility hooks (useWindowSize) | For responsive confetti sizing |
| joblib | 1.4+ | Model serialization | Save/load trained RandomForest models |
| pydantic | 2.9+ | API validation | Request/response schemas for ML service |
| axios | 1.7+ | HTTP client | Already in use for REST APIs |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @monaco-editor/react | react-ace | Monaco has better TypeScript support, larger ecosystem |
| canvas-confetti | react-confetti | canvas-confetti is lighter, more flexible |
| FastAPI | Flask | FastAPI has better async support and auto-docs |
| RandomForest | XGBoost | RandomForest simpler to deploy, easier to interpret |

**Installation:**
```bash
# Frontend
npm install @monaco-editor/react socket.io-client canvas-confetti react-use

# ML Service
pip install fastapi uvicorn scikit-learn joblib pydantic
```

---

## Architecture Patterns

### Recommended Project Structure

```
code-arena/src/
├── components/
│   ├── editor/
│   │   ├── CodeEditor.tsx          # Monaco wrapper
│   │   ├── TestCasePanel.tsx       # Test case display
│   │   └── LanguageSelector.tsx    # Language dropdown
│   ├── room/
│   │   ├── RoomLayout.tsx          # Main room layout
│   │   ├── ParticipantList.tsx     # Spectators & players
│   │   ├── RoomChat.tsx            # Room chat
│   │   └── Timer.tsx               # Countdown timer
│   ├── results/
│   │   ├── ResultModal.tsx         # Match result display
│   │   └── ConfettiEffect.tsx      # Celebration animation
│   └── history/
│       ├── MatchHistoryList.tsx    # Past matches
│       └── MatchDetail.tsx         # Single match view
├── contexts/
│   ├── SocketContext.tsx           # WebSocket provider
│   └── RoomContext.tsx             # Room state management
├── hooks/
│   ├── useSocket.ts                # Socket connection hook
│   ├── useRoomSync.ts              # Room state synchronization
│   └── usePrediction.ts            # ML prediction hook
├── lib/
│   ├── api.ts                      # REST API client (exists)
│   └── ml-api.ts                   # ML service client
└── types/
    ├── room.ts                     # Room type definitions
    ├── match.ts                    # Match type definitions
    └── prediction.ts               # Prediction types
```

### Pattern 1: Monaco Editor Integration

**What:** Integrate VS Code's Monaco Editor for a professional coding experience with syntax highlighting, IntelliSense, and error detection.

**When to use:** For all code editing interfaces where users write solutions.

**Example:**
```typescript
// components/editor/CodeEditor.tsx
import Editor from '@monaco-editor/react';
import { useRef } from 'react';

interface CodeEditorProps {
  language: string;
  value: string;
  onChange: (value: string) => void;
  height?: string;
}

export function CodeEditor({ 
  language, 
  value, 
  onChange,
  height = "60vh" 
}: CodeEditorProps) {
  const editorRef = useRef(null);

  function handleEditorDidMount(editor, monaco) {
    editorRef.current = editor;
    
    // Configure TypeScript/JavaScript defaults
    monaco.languages.typescript.javascriptDefaults.setEagerModelSync(true);
  }

  return (
    <Editor
      height={height}
      language={language}
      value={value}
      onChange={onChange}
      onMount={handleEditorDidMount}
      theme="vs-dark"
      options={{
        minimap: { enabled: false },
        fontSize: 14,
        scrollBeyondLastLine: false,
        automaticLayout: true,
        padding: { top: 16 },
        lineNumbers: "on",
        roundedSelection: false,
        scrollbar: {
          useShadows: false,
          verticalHasArrows: false,
          horizontalHasArrows: false,
          vertical: "auto",
          horizontal: "auto"
        }
      }}
    />
  );
}
```

### Pattern 2: WebSocket Context Provider

**What:** Centralize Socket.io connection management in a React Context to share across components without prop drilling.

**When to use:** When multiple components need access to real-time updates (room state, chat, notifications).

**Example:**
```typescript
// contexts/SocketContext.tsx
import { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  joinRoom: (roomId: string) => void;
  leaveRoom: (roomId: string) => void;
  emitWithAck: (event: string, data: any) => Promise<any>;
}

const SocketContext = createContext<SocketContextType | null>(null);

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { token } = useAuth();

  useEffect(() => {
    if (!token) return;

    const newSocket = io('http://localhost:3000', {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    newSocket.on('connect', () => setIsConnected(true));
    newSocket.on('disconnect', () => setIsConnected(false));
    newSocket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [token]);

  const joinRoom = (roomId: string) => {
    socket?.emit('room:join', { roomId });
  };

  const leaveRoom = (roomId: string) => {
    socket?.emit('room:leave', { roomId });
  };

  const emitWithAck = (event: string, data: any): Promise<any> => {
    return new Promise((resolve, reject) => {
      socket?.emit(event, data, (response: any) => {
        if (response?.error) {
          reject(response.error);
        } else {
          resolve(response);
        }
      });
    });
  };

  return (
    <SocketContext.Provider value={{ 
      socket, 
      isConnected, 
      joinRoom, 
      leaveRoom,
      emitWithAck 
    }}>
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) throw new Error('useSocket must be used within SocketProvider');
  return context;
};
```

### Pattern 3: Room State Synchronization Hook

**What:** Custom hook that listens to room events and maintains synchronized local state.

**When to use:** In room page components that need real-time updates about participants, game state, and chat.

**Example:**
```typescript
// hooks/useRoomSync.ts
import { useEffect, useState, useCallback } from 'react';
import { useSocket } from '../contexts/SocketContext';

interface RoomState {
  roomId: string;
  status: 'waiting' | 'starting' | 'in_progress' | 'completed';
  participants: Participant[];
  spectators: Spectator[];
  currentProblem: Problem | null;
  timeRemaining: number;
  submissions: Submission[];
}

export function useRoomSync(roomId: string) {
  const { socket, joinRoom, leaveRoom } = useSocket();
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!socket) return;

    joinRoom(roomId);
    setIsLoading(true);

    // Listen for room state updates
    socket.on('room:state', (state: RoomState) => {
      setRoomState(state);
      setIsLoading(false);
    });

    socket.on('room:error', (err: { message: string }) => {
      setError(err.message);
      setIsLoading(false);
    });

    // Incremental updates
    socket.on('room:participant_joined', (participant) => {
      setRoomState(prev => prev ? {
        ...prev,
        participants: [...prev.participants, participant]
      } : null);
    });

    socket.on('room:participant_left', ({ userId }) => {
      setRoomState(prev => prev ? {
        ...prev,
        participants: prev.participants.filter(p => p.userId !== userId)
      } : null);
    });

    socket.on('room:status_changed', ({ status }) => {
      setRoomState(prev => prev ? { ...prev, status } : null);
    });

    socket.on('room:timer_update', ({ timeRemaining }) => {
      setRoomState(prev => prev ? { ...prev, timeRemaining } : null);
    });

    return () => {
      leaveRoom(roomId);
      socket.off('room:state');
      socket.off('room:error');
      socket.off('room:participant_joined');
      socket.off('room:participant_left');
      socket.off('room:status_changed');
      socket.off('room:timer_update');
    };
  }, [socket, roomId]);

  const submitCode = useCallback(async (code: string, language: string) => {
    if (!socket) return;
    
    socket.emit('battle:submit', {
      roomId,
      code,
      language
    });
  }, [socket, roomId]);

  return {
    roomState,
    isLoading,
    error,
    submitCode
  };
}
```

### Pattern 4: ML Prediction Service

**What:** Separate FastAPI microservice for RandomForest-based winner prediction.

**When to use:** When you need to predict match outcomes based on player stats and current match state.

**Example:**
```python
# ml-service/main.py
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import joblib
import numpy as np
from typing import List, Optional

app = FastAPI(title="DevWars Prediction Service")

# Load pre-trained model on startup
model = None

def load_model():
    global model
    try:
        model = joblib.load('models/winner_predictor.pkl')
    except FileNotFoundError:
        # Train and save initial model
        from train_model import train_initial_model
        model = train_initial_model()
        joblib.dump(model, 'models/winner_predictor.pkl')

@app.on_event("startup")
async def startup_event():
    load_model()

class PlayerStats(BaseModel):
    user_id: str
    rating: float
    matches_played: int
    win_rate: float
    avg_submission_time: float
    problem_accuracy: float

class MatchFeatures(BaseModel):
    player1: PlayerStats
    player2: PlayerStats
    problem_difficulty: float
    time_remaining: float
    current_submissions_p1: int
    current_submissions_p2: int

class PredictionResponse(BaseModel):
    winner_probability: float  # Probability player1 wins
    confidence: float
    features_importance: dict

@app.post("/predict", response_model=PredictionResponse)
async def predict_winner(features: MatchFeatures):
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    # Extract features in the order model expects
    feature_vector = np.array([[
        features.player1.rating,
        features.player1.win_rate,
        features.player1.avg_submission_time,
        features.player1.problem_accuracy,
        features.player2.rating,
        features.player2.win_rate,
        features.player2.avg_submission_time,
        features.player2.problem_accuracy,
        features.problem_difficulty,
        features.time_remaining,
        features.current_submissions_p1,
        features.current_submissions_p2
    ]])
    
    # Get prediction and probability
    prediction = model.predict(feature_vector)[0]
    probabilities = model.predict_proba(feature_vector)[0]
    
    # Get feature importance
    feature_names = [
        'p1_rating', 'p1_win_rate', 'p1_avg_time', 'p1_accuracy',
        'p2_rating', 'p2_win_rate', 'p2_avg_time', 'p2_accuracy',
        'problem_difficulty', 'time_remaining', 
        'p1_submissions', 'p2_submissions'
    ]
    
    return PredictionResponse(
        winner_probability=float(probabilities[1]),
        confidence=float(max(probabilities)),
        features_importance=dict(zip(feature_names, model.feature_importances_.tolist()))
    )

@app.get("/health")
async def health_check():
    return {"status": "healthy", "model_loaded": model is not None}
```

### Pattern 5: Result Modal with Confetti

**What:** Animated result modal that celebrates wins and clearly displays match results.

**When to use:** At the end of a competitive match to show final standings.

**Example:**
```typescript
// components/results/ResultModal.tsx
import { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { useWindowSize } from 'react-use';

interface ResultModalProps {
  isOpen: boolean;
  result: 'win' | 'loss' | 'draw';
  playerStats: {
    rank: number;
    score: number;
    executionTime: number;
    testCasesPassed: number;
  };
  opponentStats: {
    username: string;
    score: number;
  };
  onClose: () => void;
  onPlayAgain: () => void;
}

export function ResultModal({
  isOpen,
  result,
  playerStats,
  opponentStats,
  onClose,
  onPlayAgain
}: ResultModalProps) {
  const { width, height } = useWindowSize();
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (isOpen && result === 'win') {
      setShowConfetti(true);
      
      // Launch multiple bursts for dramatic effect
      const duration = 3000;
      const end = Date.now() + duration;

      const frame = () => {
        confetti({
          particleCount: 3,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff']
        });
        confetti({
          particleCount: 3,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff']
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      };

      frame();
      
      return () => setShowConfetti(false);
    }
  }, [isOpen, result, width, height]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
      {showConfetti && (
        <canvas
          className="fixed inset-0 pointer-events-none z-50"
          style={{ width, height }}
        />
      )}
      
      <div className="bg-white dark:bg-gray-900 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl animate-in fade-in zoom-in duration-300">
        {/* Result Header */}
        <div className="text-center mb-6">
          {result === 'win' && (
            <>
              <div className="text-6xl mb-2">🏆</div>
              <h2 className="text-3xl font-bold text-green-500">Victory!</h2>
            </>
          )}
          {result === 'loss' && (
            <>
              <div className="text-6xl mb-2">💪</div>
              <h2 className="text-3xl font-bold text-orange-500">Good Try!</h2>
            </>
          )}
          {result === 'draw' && (
            <>
              <div className="text-6xl mb-2">🤝</div>
              <h2 className="text-3xl font-bold text-blue-500">Draw!</h2>
            </>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg text-center">
            <div className="text-sm text-gray-500">Your Score</div>
            <div className="text-2xl font-bold">{playerStats.score}</div>
          </div>
          <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg text-center">
            <div className="text-sm text-gray-500">Rank</div>
            <div className="text-2xl font-bold">#{playerStats.rank}</div>
          </div>
          <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg text-center">
            <div className="text-sm text-gray-500">Time</div>
            <div className="text-2xl font-bold">{playerStats.executionTime}s</div>
          </div>
          <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg text-center">
            <div className="text-sm text-gray-500">Tests Passed</div>
            <div className="text-2xl font-bold">{playerStats.testCasesPassed}</div>
          </div>
        </div>

        {/* Opponent Comparison */}
        <div className="border-t pt-4 mb-6">
          <div className="text-sm text-gray-500 text-center mb-2">vs {opponentStats.username}</div>
          <div className="flex justify-between items-center">
            <span className="text-lg font-semibold">{playerStats.score}</span>
            <span className="text-gray-400">-</span>
            <span className="text-lg font-semibold">{opponentStats.score}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onPlayAgain}
            className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-lg font-semibold transition-colors"
          >
            Play Again
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 py-3 rounded-lg font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
```

### Anti-Patterns to Avoid

- **Creating new socket connections per component:** Always use a shared Context Provider
- **Storing editor content in global state:** Use local state or refs to avoid re-renders on every keystroke
- **Syncing entire room state on every update:** Use incremental updates with specific event types
- **Training ML model on every prediction:** Pre-train and save models, load on service startup
- **Embedding test case data in match documents:** Reference test cases by ID to avoid duplication

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Code editor | Custom textarea | @monaco-editor/react | Syntax highlighting, IntelliSense, error detection, 3.2M weekly downloads |
| WebSocket client | Raw WebSocket API | socket.io-client | Auto-reconnect, room management, event acknowledgment, fallback support |
| Confetti animation | CSS animations | canvas-confetti | GPU-accelerated, performant, customizable, 2.4M weekly downloads |
| ML model serving | Flask sync endpoints | FastAPI | Async support, automatic validation, OpenAPI docs, modern Python |
| State management | Redux for socket state | React Context + Hooks | Simpler, less boilerplate, sufficient for socket state |

**Key insight:** Monaco Editor alone would take months to build with equivalent features. Socket.io handles edge cases (reconnects, fallbacks) that are easy to miss in custom implementations.

---

## Common Pitfalls

### Pitfall 1: Monaco Editor Loading Performance
**What goes wrong:** Monaco loads slowly or fails in certain environments (Electron, offline).
**Why it happens:** Default CDN loading may be blocked or slow.
**How to avoid:** Configure loader to use local files or custom CDN paths.
**Warning signs:** "Loading..." stuck indefinitely, editor never appears.

### Pitfall 2: Socket Event Listener Duplication
**What goes wrong:** Multiple event handlers fire for the same event, causing duplicate updates.
**Why it happens:** Not cleaning up listeners in useEffect, or registering listeners inside re-rendering components.
**How to avoid:** Always return cleanup function from useEffect, use useCallback for event handlers.
**Warning signs:** State updates happening multiple times, console logs appearing in pairs.

### Pitfall 3: ML Model Version Mismatch
**What goes wrong:** Saved model fails to load after feature changes.
**Why it happens:** Features used during training don't match prediction-time features.
**How to avoid:** Version model files with feature schemas, validate input shapes.
**Warning signs:** Prediction errors, shape mismatch exceptions.

### Pitfall 4: MongoDB Document Size Limits
**What goes wrong:** Match history documents exceed 16MB limit.
**Why it happens:** Embedding large test case outputs, console logs, or execution traces.
**How to avoid:** Store large outputs in GridFS or separate collections, reference by ID.
**Warning signs:** "document too large" errors during save operations.

### Pitfall 5: Confetti Performance on Mobile
**What goes wrong:** Confetti animation causes jank or battery drain on mobile devices.
**Why it happens:** Too many particles, no throttling, not checking device capabilities.
**How to avoid:** Reduce particle count on mobile, use requestAnimationFrame, limit duration.
**Warning signs:** Frame rate drops during animation, hot device.

---

## Code Examples

### MongoDB Schema Patterns

```javascript
// models/TestCase.js
const mongoose = require('mongoose');

const testCaseSchema = new mongoose.Schema({
  problem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Problem',
    required: true,
    index: true
  },
  input: {
    type: String,
    required: true
  },
  expectedOutput: {
    type: String,
    required: true
  },
  isPublic: {
    type: Boolean,
    default: false
  },
  weight: {
    type: Number,
    default: 1,
    min: 0,
    max: 1
  },
  timeLimit: {
    type: Number,
    default: 2000 // milliseconds
  },
  memoryLimit: {
    type: Number,
    default: 256 // MB
  }
}, { timestamps: true });

module.exports = mongoose.model('TestCase', testCaseSchema);
```

```javascript
// models/Spectator.js
const mongoose = require('mongoose');

const spectatorSchema = new mongoose.Schema({
  room: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    required: true,
    index: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  joinedAt: {
    type: Date,
    default: Date.now
  },
  leftAt: {
    type: Date
  },
  chatEnabled: {
    type: Boolean,
    default: true
  }
});

// Compound index to ensure unique active spectators
spectatorSchema.index({ room: 1, user: 1, leftAt: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Spectator', spectatorSchema);
```

```javascript
// models/MatchHistory.js
const mongoose = require('mongoose');

const submissionResultSchema = new mongoose.Schema({
  testCase: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TestCase',
    required: true
  },
  passed: {
    type: Boolean,
    required: true
  },
  actualOutput: String,
  executionTime: Number,
  memoryUsed: Number,
  error: String
}, { _id: false });

const participantResultSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  username: {
    type: String,
    required: true
  },
  initialRating: Number,
  finalRating: Number,
  score: {
    type: Number,
    default: 0
  },
  submissions: [{
    code: String,
    language: String,
    submittedAt: Date,
    results: [submissionResultSchema],
    totalPassed: Number,
    executionTime: Number
  }],
  rank: Number
}, { _id: false });

const matchHistorySchema = new mongoose.Schema({
  room: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    required: true
  },
  problem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Problem',
    required: true
  },
  status: {
    type: String,
    enum: ['in_progress', 'completed', 'cancelled'],
    default: 'in_progress'
  },
  startedAt: {
    type: Date,
    required: true
  },
  endedAt: Date,
  duration: {
    type: Number, // in seconds
    required: true
  },
  participants: [participantResultSchema],
  spectators: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  winner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  chatLog: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    username: String,
    message: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }]
}, { timestamps: true });

// Indexes for common queries
matchHistorySchema.index({ 'participants.user': 1, createdAt: -1 });
matchHistorySchema.index({ winner: 1, createdAt: -1 });
matchHistorySchema.index({ problem: 1, createdAt: -1 });

module.exports = mongoose.model('MatchHistory', matchHistorySchema);
```

### Docker Sandbox Integration (Frontend Perspective)

```typescript
// lib/code-execution.ts
import { api } from './api';

interface ExecutionRequest {
  code: string;
  language: string;
  testCases: string[];
  timeLimit?: number;
  memoryLimit?: number;
}

interface ExecutionResult {
  success: boolean;
  results: Array<{
    testCaseId: string;
    passed: boolean;
    output: string;
    expectedOutput: string;
    executionTime: number;
    memoryUsed: number;
    error?: string;
  }>;
  totalPassed: number;
  totalTestCases: number;
  compilationError?: string;
}

export async function executeCodeInSandbox(
  request: ExecutionRequest
): Promise<ExecutionResult> {
  const response = await api.post('/battle/execute', request);
  return response.data;
}

// Component usage
import { useState } from 'react';
import { useSocket } from '../contexts/SocketContext';

export function useCodeSubmission(roomId: string) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState<ExecutionResult | null>(null);
  const { socket } = useSocket();

  const submitCode = async (code: string, language: string) => {
    setIsSubmitting(true);
    
    try {
      // Send to backend which will run in Docker sandbox
      socket?.emit('battle:submit', {
        roomId,
        code,
        language
      }, (response: ExecutionResult) => {
        setLastResult(response);
        setIsSubmitting(false);
      });
    } catch (error) {
      setIsSubmitting(false);
      throw error;
    }
  };

  return { submitCode, isSubmitting, lastResult };
}
```

### Competition History Page

```typescript
// pages/History.tsx
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

interface MatchSummary {
  _id: string;
  startedAt: string;
  duration: number;
  problem: {
    title: string;
    difficulty: 'easy' | 'medium' | 'hard';
  };
  myResult: {
    rank: number;
    score: number;
    ratingChange: number;
  };
  opponent: {
    username: string;
    score: number;
  };
  winner: string | null;
}

export function HistoryPage() {
  const { user } = useAuth();
  const [matches, setMatches] = useState<MatchSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'wins' | 'losses'>('all');

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await api.get('/users/me/history');
        setMatches(response.data.matches);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
  }, []);

  const filteredMatches = matches.filter(match => {
    if (filter === 'all') return true;
    if (filter === 'wins') return match.winner === user?.id;
    if (filter === 'losses') return match.winner && match.winner !== user?.id;
    return true;
  });

  const stats = {
    total: matches.length,
    wins: matches.filter(m => m.winner === user?.id).length,
    avgScore: matches.reduce((acc, m) => acc + m.myResult.score, 0) / matches.length || 0
  };

  if (isLoading) return <div>Loading history...</div>;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Match History</h1>
      
      {/* Stats Overview */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold">{stats.total}</div>
          <div className="text-gray-500">Total Matches</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-green-500">{stats.wins}</div>
          <div className="text-gray-500">Wins</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold">{stats.avgScore.toFixed(0)}</div>
          <div className="text-gray-500">Avg Score</div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6">
        {(['all', 'wins', 'losses'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg capitalize ${
              filter === f 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-200 hover:bg-gray-300'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Match List */}
      <div className="space-y-4">
        {filteredMatches.map((match) => (
          <div 
            key={match._id}
            className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow"
          >
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-semibold">{match.problem.title}</h3>
                <p className="text-sm text-gray-500">
                  {new Date(match.startedAt).toLocaleDateString()} • {Math.floor(match.duration / 60)}m
                </p>
              </div>
              <div className={`text-lg font-bold ${
                match.winner === user?.id ? 'text-green-500' : 'text-red-500'
              }`}>
                {match.winner === user?.id ? 'WIN' : 'LOSS'}
              </div>
            </div>
            
            <div className="mt-4 flex justify-between items-center">
              <div className="flex items-center gap-4">
                <span className="text-2xl">#{match.myResult.rank}</span>
                <div>
                  <div className="font-semibold">{match.myResult.score} pts</div>
                  <div className={`text-sm ${
                    match.myResult.ratingChange >= 0 ? 'text-green-500' : 'text-red-500'
                  }`}>
                    {match.myResult.ratingChange >= 0 ? '+' : ''}{match.myResult.ratingChange}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-500">vs</div>
                <div className="font-semibold">{match.opponent.username}</div>
                <div className="text-sm">{match.opponent.score} pts</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| react-monaco-editor | @monaco-editor/react | 2023-2024 | Better React integration, no webpack config needed |
| Raw WebSocket API | Socket.io with React Context | 2022-2025 | Auto-reconnect, room management, simpler code |
| Redux for all state | Zustand/Jotai for local, Context for global | 2023-2025 | Less boilerplate, better performance |
| Flask for ML APIs | FastAPI with async | 2020-2025 | Better performance, modern Python, auto-docs |
| CSS animations for effects | canvas-confetti | 2020-2025 | GPU-accelerated, more performant |

**Deprecated/outdated:**
- `react-monaco-editor`: No longer maintained, use `@monaco-editor/react`
- `react-confetti`: Heavier than `canvas-confetti`, less flexible
- MongoDB `$push` to unlimited arrays: Use `$slice` or separate collections to avoid document size limits

---

## Open Questions

1. **How to handle test case output storage for large outputs?**
   - What we know: MongoDB has 16MB document limit, GridFS available for larger files
   - What's unclear: Threshold for switching to GridFS, compression strategies
   - Recommendation: Store outputs <100KB in document, larger in GridFS with compression

2. **What's the best approach for ML model retraining?**
   - What we know: RandomForest can be updated incrementally, need to track feature drift
   - What's unclear: Retraining frequency, A/B testing approach for model updates
   - Recommendation: Start with weekly batch retraining, monitor accuracy metrics

3. **How to optimize WebSocket broadcast for spectators?**
   - What we know: Socket.io rooms support broadcast, Redis adapter for scaling
   - What's unclear: Optimal update frequency for spectator view, delta vs full state sync
   - Recommendation: Full state on join, delta updates every 1-2 seconds during active gameplay

4. **What's the optimal Monaco Editor configuration for competitive coding?**
   - What we know: Can disable minimap, customize themes, set font sizes
   - What's unclear: Best settings for 1080p vs 4K, accessibility requirements
   - Recommendation: Provide user preferences, default to large fonts, high contrast

---

## Sources

### Primary (HIGH confidence)
- @monaco-editor/react GitHub - Official documentation and examples
- Socket.io React Integration Guide (VideoSDK, 2025) - Production patterns
- scikit-learn RandomForestClassifier docs - Official API reference
- MongoDB Gaming Solutions Documentation - Industry schema patterns
- Mongoose Schema Design Best Practices (GeeksforGeeks, 2025)

### Secondary (MEDIUM confidence)
- FastAPI ML Deployment tutorials (PylearnAI) - Verified patterns
- canvas-confetti npm documentation - Usage patterns
- React Confetti Effects Guide (DEV Community, 2025) - Community best practices
- Docker Sandboxes for Code Execution (Docker Blog, 2025) - Security patterns

### Tertiary (LOW confidence)
- NFL Win Prediction with RandomForest (Frontiers, 2025) - ML research context
- CodeSearch results for Socket.io React patterns - Implementation examples

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries verified with official sources, latest versions confirmed
- Architecture: MEDIUM-HIGH - Patterns from official docs and verified tutorials
- Pitfalls: MEDIUM - Some based on training data, cross-referenced with community sources

**Research date:** 2026-02-18
**Valid until:** 2026-04-18 (60 days - stable ecosystem)

---

## Key Findings Summary

### Monaco Editor Integration
- **Library:** `@monaco-editor/react` v4.7.0+ (3.2M weekly downloads)
- **Key Features:** Zero webpack config, TypeScript support, multi-model editor for tabs
- **Configuration:** Disable minimap for competitive coding, use vs-dark theme
- **Performance:** CDN loading by default, can bundle locally for offline

### WebSocket Room Synchronization
- **Pattern:** Socket.io Context Provider with custom hooks
- **State Strategy:** Full state on room join, incremental updates via specific events
- **Scaling:** Redis adapter for multi-server deployments
- **Anti-pattern:** Avoid storing socket state in Redux/Zustand

### ML Prediction Service
- **Approach:** FastAPI microservice with scikit-learn RandomForest
- **Deployment:** Pre-trained model loaded on startup, predict via REST API
- **Features:** Player ratings, win rates, submission times, problem difficulty, time remaining
- **Response:** Winner probability + confidence + feature importance

### MongoDB Schema Patterns
- **Test Cases:** Separate collection with problem reference, public/private flags
- **Spectators:** Join/leave timestamps, compound index for active status
- **Match History:** Embedded participant results (limited size), indexed for user queries
- **Avoid:** Embedding large outputs, unbounded arrays

### Docker Sandbox Integration
- **Frontend:** Sends code via WebSocket/HTTP to backend
- **Backend:** Runs code in isolated Docker container with resource limits
- **Response:** Test case results, execution metrics, errors
- **Security:** Timeout and memory limits enforced by container

### Result Modal UX
- **Animation:** canvas-confetti with multiple burst patterns for wins
- **Content:** Rank, score, execution time, test cases passed
- **Comparison:** Show vs opponent stats
- **Actions:** Play again, close, view details

### Competition History
- **Data Model:** Match summary with embedded problem info and participant results
- **Features:** Filter by win/loss/all, stats overview (total, wins, avg score)
- **Pagination:** Infinite scroll or traditional pagination
- **Indexing:** Compound index on user + createdAt for performance
