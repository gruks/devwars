"# Sandbox Service - Integration Examples

## Node.js / Express Backend Integration

```javascript
import express from 'express';
import fetch from 'node-fetch';

const app = express();
app.use(express.json());

const SANDBOX_URL = 'http://sandbox-service:3000/api';

// Execute user-submitted code
app.post('/battle/execute', async (req, res) => {
  const { userId, language, code } = req.body;

  try {
    const response = await fetch(`${SANDBOX_URL}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language,
        code,
        timeout: 2000
      })
    });

    const result = await response.json();

    // Store result in your database
    await saveExecutionResult(userId, result);

    return res.json({
      success: true,
      output: result.stdout,
      error: result.stderr,
      runtime: result.runtime,
      status: result.status
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.listen(4000);
```

---

## Python / FastAPI Backend Integration

```python
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import httpx

app = FastAPI()

SANDBOX_URL = \"http://sandbox-service:3000/api\"

class ExecuteRequest(BaseModel):
    user_id: str
    language: str
    code: str
    timeout: int = 2000

@app.post(\"/battle/execute\")
async def execute_code(request: ExecuteRequest):
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                f\"{SANDBOX_URL}/execute\",
                json={
                    \"language\": request.language,
                    \"code\": request.code,
                    \"timeout\": request.timeout
                },
                timeout=10.0
            )
            
            result = response.json()
            
            # Store in your database
            await save_execution_result(request.user_id, result)
            
            return {
                \"success\": True,
                \"output\": result[\"stdout\"],
                \"error\": result[\"stderr\"],
                \"runtime\": result[\"runtime\"],
                \"status\": result[\"status\"]
            }
            
        except httpx.TimeoutException:
            raise HTTPException(status_code=408, detail=\"Execution timeout\")
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
```

---

## Next.js API Route Integration

```typescript
// pages/api/execute.ts
import type { NextApiRequest, NextApiResponse } from 'next';

const SANDBOX_URL = 'http://sandbox-service:3000/api';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { language, code, timeout = 2000 } = req.body;

  try {
    const response = await fetch(`${SANDBOX_URL}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language, code, timeout })
    });

    const result = await response.json();

    return res.status(200).json({
      success: result.status === 'success',
      output: result.stdout,
      error: result.stderr,
      runtime: result.runtime,
      memory: result.memory
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
```

---

## React Frontend Component

```typescript
import React, { useState } from 'react';

interface ExecutionResult {
  status: 'success' | 'error' | 'timeout';
  stdout: string;
  stderr: string;
  runtime: string;
  memory: string;
}

export const CodeExecutor: React.FC = () => {
  const [code, setCode] = useState('print(\"Hello, World!\")');
  const [language, setLanguage] = useState('python');
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [loading, setLoading] = useState(false);

  const executeCode = async () => {
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language, code, timeout: 2000 })
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error('Execution failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className=\"code-executor\">
      <select value={language} onChange={(e) => setLanguage(e.target.value)}>
        <option value=\"python\">Python</option>
        <option value=\"javascript\">JavaScript</option>
        <option value=\"cpp\">C++</option>
        <option value=\"java\">Java</option>
        <option value=\"go\">Go</option>
      </select>

      <textarea
        value={code}
        onChange={(e) => setCode(e.target.value)}
        rows={10}
        cols={50}
      />

      <button onClick={executeCode} disabled={loading}>
        {loading ? 'Executing...' : 'Run Code'}
      </button>

      {result && (
        <div className=\"result\">
          <h3>Output:</h3>
          <pre>{result.stdout || result.stderr}</pre>
          <p>Status: {result.status}</p>
          <p>Runtime: {result.runtime}</p>
          <p>Memory: {result.memory}</p>
        </div>
      )}
    </div>
  );
};
```

---

## Algorithm Battle System

```javascript
// Competitive programming battle system
class AlgorithmBattle {
  constructor(sandboxUrl) {
    this.sandboxUrl = sandboxUrl;
  }

  async judgeSubmission(submission) {
    const { userId, problemId, language, code, testCases } = submission;
    
    const results = [];

    // Run code against all test cases
    for (const testCase of testCases) {
      const result = await this.executeTestCase(
        language,
        code,
        testCase.input
      );

      results.push({
        testCaseId: testCase.id,
        passed: result.stdout.trim() === testCase.expectedOutput.trim(),
        output: result.stdout,
        runtime: result.runtime,
        status: result.status
      });
    }

    const totalTests = results.length;
    const passedTests = results.filter(r => r.passed).length;
    const score = (passedTests / totalTests) * 100;

    return {
      userId,
      problemId,
      score,
      passedTests,
      totalTests,
      results,
      status: passedTests === totalTests ? 'accepted' : 'failed'
    };
  }

  async executeTestCase(language, code, input) {
    const response = await fetch(`${this.sandboxUrl}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language,
        code,
        input,
        timeout: 3000
      })
    });

    return await response.json();
  }
}

// Usage
const battle = new AlgorithmBattle('http://sandbox-service:3000/api');

const submission = {
  userId: 'user123',
  problemId: 'two-sum',
  language: 'python',
  code: 'def solve(nums, target): ...',
  testCases: [
    { id: 1, input: '2 7 11 15
9', expectedOutput: '0 1' },
    { id: 2, input: '3 2 4
6', expectedOutput: '1 2' },
    { id: 3, input: '3 3
6', expectedOutput: '0 1' }
  ]
};

const result = await battle.judgeSubmission(submission);
console.log(`Score: ${result.score}% (${result.passedTests}/${result.totalTests})`);
```

---

## WebSocket Real-Time Battle

```javascript
import { Server } from 'socket.io';
import fetch from 'node-fetch';

const io = new Server(3001);
const SANDBOX_URL = 'http://sandbox-service:3000/api';

io.on('connection', (socket) => {
  console.log(`Player ${socket.id} connected`);

  socket.on('submit-code', async (data) => {
    const { battleId, language, code } = data;

    // Execute code
    const response = await fetch(`${SANDBOX_URL}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language, code, timeout: 2000 })
    });

    const result = await response.json();

    // Broadcast result to battle room
    io.to(battleId).emit('code-result', {
      playerId: socket.id,
      result,
      timestamp: Date.now()
    });

    // Check if player won
    if (result.status === 'success' && isCorrectOutput(result.stdout)) {
      io.to(battleId).emit('battle-won', {
        winner: socket.id,
        runtime: result.runtime
      });
    }
  });

  socket.on('join-battle', (battleId) => {
    socket.join(battleId);
  });
});
```

---

## Microservices Architecture

```yaml
# docker-compose.yml for full DevWars stack

version: '3.8'

services:
  # Main backend
  devwars-backend:
    image: devwars/backend:latest
    ports:
      - \"4000:4000\"
    environment:
      - SANDBOX_SERVICE_URL=http://sandbox-service:3000
      - DATABASE_URL=postgresql://...
    depends_on:
      - postgres
      - sandbox-service

  # Sandbox microservice
  sandbox-service:
    image: devwars/sandbox-service:latest
    ports:
      - \"3000:3000\"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    depends_on:
      - redis

  # Sandbox worker
  sandbox-worker:
    image: devwars/sandbox-service:latest
    command: node src/workers/executor.js
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    depends_on:
      - redis
    deploy:
      replicas: 3

  # Redis queue
  redis:
    image: redis:7-alpine
    volumes:
      - redis-data:/data

  # Main database
  postgres:
    image: postgres:15
    volumes:
      - postgres-data:/var/lib/postgresql/data

  # Frontend
  devwars-frontend:
    image: devwars/frontend:latest
    ports:
      - \"80:80\"
    depends_on:
      - devwars-backend

volumes:
  redis-data:
  postgres-data:
```

---

## Kubernetes Service Mesh

```yaml
# Service definition for inter-service communication

apiVersion: v1
kind: Service
metadata:
  name: sandbox-service
  namespace: devwars
spec:
  selector:
    app: sandbox-api
  ports:
  - name: http
    port: 80
    targetPort: 3000
  type: ClusterIP

---

# Backend deployment referencing sandbox service
apiVersion: apps/v1
kind: Deployment
metadata:
  name: devwars-backend
  namespace: devwars
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: backend
        image: devwars/backend:latest
        env:
        - name: SANDBOX_SERVICE_URL
          value: \"http://sandbox-service.devwars.svc.cluster.local\"
```

---

## Testing Integration

```javascript
// Integration test example
import { describe, it, expect } from 'vitest';
import fetch from 'node-fetch';

describe('Sandbox Service Integration', () => {
  const SANDBOX_URL = 'http://localhost:3000/api';

  it('should execute Python code successfully', async () => {
    const response = await fetch(`${SANDBOX_URL}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language: 'python',
        code: 'print(\"test\")',
        timeout: 2000
      })
    });

    const result = await response.json();

    expect(result.status).toBe('success');
    expect(result.stdout).toBe('test');
    expect(result.stderr).toBe('');
  });

  it('should handle timeout correctly', async () => {
    const response = await fetch(`${SANDBOX_URL}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language: 'python',
        code: 'while True: pass',
        timeout: 1000
      })
    });

    const result = await response.json();

    expect(result.status).toBe('timeout');
  });

  it('should handle syntax errors', async () => {
    const response = await fetch(`${SANDBOX_URL}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language: 'python',
        code: 'print(\"unclosed',
        timeout: 2000
      })
    });

    const result = await response.json();

    expect(result.status).toBe('error');
    expect(result.stderr).toContain('SyntaxError');
  });
});
```

---

## Rate Limiting Middleware

```javascript
import rateLimit from 'express-rate-limit';

// Limit executions per user
const executionLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 executions per minute
  message: {
    error: 'Too many execution requests. Please try again later.'
  },
  keyGenerator: (req) => req.user.id // Rate limit by user ID
});

app.post('/battle/execute', executionLimiter, async (req, res) => {
  // Execute code via sandbox service
});
```

---

## Monitoring Integration

```javascript
import promClient from 'prom-client';

const executionCounter = new promClient.Counter({
  name: 'devwars_code_executions_total',
  help: 'Total code executions',
  labelNames: ['language', 'status']
});

app.post('/battle/execute', async (req, res) => {
  const { language, code } = req.body;

  const result = await fetch('http://sandbox-service:3000/api/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ language, code, timeout: 2000 })
  }).then(r => r.json());

  // Track metrics
  executionCounter.inc({ language, status: result.status });

  res.json(result);
});
```

---

**Production-ready integration examples for DevWars platform 🎮**
"