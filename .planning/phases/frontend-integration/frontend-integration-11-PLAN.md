---
phase: frontend-integration
plan: '11'
type: execute
wave: 3
depends_on:
  - frontend-integration-09
  - frontend-integration-10
files_modified:
  - code-arena/src/components/room/ResultModal.tsx
  - code-arena/src/components/room/Confetti.tsx
  - code-arena/src/pages/History.tsx
  - code-arena/src/components/history/HistoryCard.tsx
  - backend/src/modules/competition/competition.controller.js
  - backend/src/modules/competition/competition.routes.js
autonomous: true

must_haves:
  truths:
    - Result modal shows when match completes
    - Modal displays winner name and score breakdown
    - Time comparison shown for both players
    - Confetti animation plays for winner
    - History page accessible at /app/history
    - History shows only competitions user participated in
    - History cards show opponent, result, date
  artifacts:
    - path: code-arena/src/components/room/ResultModal.tsx
      provides: Match result display modal
      min_lines: 100
    - path: code-arena/src/pages/History.tsx
      provides: Competition history page
      min_lines: 80
    - path: backend/src/modules/competition/competition.controller.js
      provides: History API endpoints
      min_lines: 60
  key_links:
    - from: ResultModal.tsx
      to: CompetitionHistory API
      via: GET /api/v1/competition/history
      pattern: fetch competition result after match
    - from: History.tsx
      to: competition.controller.js
      via: GET /api/v1/competition/history
      pattern: fetch user's private history
---

<objective>
Build result modal with winner display and confetti animation, plus private competition history page accessible only to participants.

Purpose: Show match results in an engaging way and allow users to review their past competitions.

Output: Result modal component, confetti animation, history page, history API endpoints.
</objective>

<execution_context>
@C:/Users/HP/.config/opencode/get-shit-done/workflows/execute-plan.md
@C:/Users/HP/.config/opencode/get-shit-done/templates/summary.md
</execution_context>

<context>
@E:/Projects/DevWars/.planning/phases/frontend-integration/frontend-integration-RESEARCH.md
@E:/Projects/DevWars/backend/src/modules/competition/competitionHistory.model.js
@E:/Projects/DevWars/code-arena/src/pages
</context>

<tasks>

<task type="auto">
  <name>Create Result Modal component per RESEARCH.md Pattern 5</name>
  <files>code-arena/src/components/room/ResultModal.tsx</files>
  <action>
    Create ResultModal for match completion per RESEARCH.md Pattern 5:
    
    Props interface:
    - isOpen: boolean
    - onClose: () => void
    - result: {
        winner: { username, avatar, score }
        player1: { username, score, timeToSolve, passedTestCases }
        player2: { username, score, timeToSolve, passedTestCases }
        mlPrediction: { confidence, reasoning, featureImportance }
        problemTitle: string
      }
    - isWinner: boolean (current user)
    
    Implementation per RESEARCH.md Pattern 5:
    ```typescript
    import { useEffect, useState } from 'react';
    import { Confetti } from './Confetti';
    
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
      if (!isOpen) return null;
      
      return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
          {/* Confetti for winner (per RESEARCH.md Pattern 5) */}
          {result === 'win' && <Confetti trigger={isOpen} mode="winner" />}
          
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
              <div className="text-sm text-gray-500 text-center mb-2">
                vs {opponentStats.username}
              </div>
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold">{playerStats.score}</span>
                <span className="text-gray-400">-</span>
                <span className="text-lg font-semibold">{opponentStats.score}</span>
              </div>
            </div>
            
            {/* ML Prediction (if available) */}
            {mlPrediction && (
              <div className="border-t pt-4 mb-6">
                <div className="text-sm text-gray-500 text-center mb-2">
                  AI Confidence: {(mlPrediction.confidence * 100).toFixed(0)}%
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-500 h-2 rounded-full transition-all duration-1000"
                    style={{ width: `${mlPrediction.confidence * 100}%` }}
                  />
                </div>
              </div>
            )}
            
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
    
    Features per RESEARCH.md Pattern 5:
    - Dark overlay with backdrop blur
    - Animated modal entry (fade-in + zoom)
    - Result-specific header with emoji and color
    - Stats grid with score, rank, time, test cases
    - Opponent comparison with vs display
    - ML prediction confidence bar
    - Confetti animation for wins
    - Play Again and Close actions
    
    Styling:
    - Dark theme support (dark:bg-gray-900)
    - Responsive max-width (max-w-md)
    - Centered layout with flex
    - Consistent with RESEARCH.md examples
  </action>
  <verify>Modal displays per RESEARCH.md Pattern 5: winner, stats grid, opponent comparison, ML confidence, confetti for wins</verify>
  <done>Result modal per RESEARCH.md Pattern 5 with winner celebration</done>
</task>

<task type="auto">
  <name>Create Confetti animation component per RESEARCH.md Pattern 5</name>
  <files>code-arena/src/components/room/Confetti.tsx</files>
  <action>
    Create reusable Confetti component per RESEARCH.md Pattern 5:
    
    Install: canvas-confetti@^1.9.0, react-use@^17.5 (for useWindowSize)
    
    Props interface:
    - trigger: boolean (start animation when true)
    - duration?: number (default: 3000ms)
    - particleCount?: number (default: 150)
    - colors?: string[] (default: ['#FFD700', '#C0C0C0', '#3B82F6'])
    - mode?: 'celebration' | 'subtle' | 'winner'
    
    Implementation per RESEARCH.md Pattern 5:
    ```typescript
    import { useEffect, useState } from 'react';
    import confetti from 'canvas-confetti';
    import { useWindowSize } from 'react-use';
    
    interface ConfettiProps {
      trigger: boolean;
      duration?: number;
      particleCount?: number;
      colors?: string[];
      mode?: 'celebration' | 'subtle' | 'winner';
    }
    
    export function Confetti({
      trigger,
      duration = 3000,
      particleCount = 150,
      colors = ['#FFD700', '#C0C0C0', '#3B82F6'],
      mode = 'celebration'
    }: ConfettiProps) {
      const { width, height } = useWindowSize();
      const [isActive, setIsActive] = useState(false);
      
      useEffect(() => {
        if (!trigger || isActive) return;
        
        setIsActive(true);
        
        // Multiple bursts for dramatic effect (per RESEARCH.md Pattern 5)
        const end = Date.now() + duration;
        
        const frame = () => {
          // Left side burst
          confetti({
            particleCount: 3,
            angle: 60,
            spread: 55,
            origin: { x: 0 },
            colors: colors,
            gravity: 1.2,
            drift: 0,
            ticks: 200
          });
          
          // Right side burst  
          confetti({
            particleCount: 3,
            angle: 120,
            spread: 55,
            origin: { x: 1 },
            colors: colors,
            gravity: 1.2,
            drift: 0,
            ticks: 200
          });
          
          if (Date.now() < end) {
            requestAnimationFrame(frame);
          } else {
            setIsActive(false);
          }
        };
        
        frame();
        
        return () => {
          setIsActive(false);
        };
      }, [trigger, duration, colors, width, height, isActive]);
      
      return null; // Confetti renders to canvas automatically
    }
    ```
    
    Mode configurations per RESEARCH.md:
    - 'celebration': 3000ms, 150 particles, multi-color
    - 'subtle': 1500ms, 80 particles, fewer bursts
    - 'winner': 4000ms, 200 particles, gold emphasis colors ['#FFD700', '#FFA500', '#FF6B35']
    
    Performance considerations (per RESEARCH.md Pitfall 5):
    - Use requestAnimationFrame for smooth animation
    - Auto-stop after duration to prevent memory leaks
    - Check isActive to prevent duplicate triggers
    - Canvas-confetti is GPU-accelerated (2.4M weekly downloads)
    
    Usage in ResultModal:
    ```tsx
    import { Confetti } from './Confetti';
    
    export function ResultModal({ isOpen, result, ...props }) {
      const isWinner = result === 'win';
      
      return (
        <div className="modal-overlay">
          {isWinner && <Confetti trigger={isOpen} mode="winner" />}
          {/* modal content */}
        </div>
      );
    }
    ```
  </action>
  <verify>Confetti animates with multiple bursts when triggered, auto-cleans up after duration, uses requestAnimationFrame</verify>
  <done>Confetti animation component per RESEARCH.md Pattern 5 with winner celebration mode</done>
</task>

<task type="auto">
  <name>Create competition history API endpoints</name>
  <files>backend/src/modules/competition/competition.controller.js, backend/src/modules/competition/competition.routes.js</files>
  <action>
    Create history API endpoints:
    
    1. competition.controller.js:
       - GET /api/v1/competition/history
         Query: { page = 1, limit = 10 }
         - Get userId from req.user
         - Call CompetitionHistory.findForUser(userId)
         - Populate: participants (username, avatar), winner (username), problemId (title)
         - Sort: createdAt desc
         - Paginate: skip, limit
         - Return: { success, data: { history, pagination } }
       
       - GET /api/v1/competition/history/:historyId
         - Validate historyId
         - Fetch specific history entry
         - Verify req.user is in participants
         - Populate all references
         - Return: { success, data: history }
       
       - POST /api/v1/competition/history (internal use)
         - Called when match completes
         - Create CompetitionHistory entry
         - Populate from room data
         - Return: { success, data: historyId }
    
    2. competition.routes.js:
       - GET /history - authenticate, pagination
       - GET /history/:id - authenticate, validateObjectId
       - POST /history - authenticate, authorize('admin', 'system')
    
    3. Register routes in app.js
    
    Privacy enforcement:
    - Always filter by participants.includes(req.user._id)
    - Return 404 if user not participant (don't reveal existence)
  </action>
  <verify>API returns only user's competitions, 404 for others</verify>
  <done>History API endpoints with privacy controls</done>
</task>

<task type="auto">
  <name>Create History Card component</name>
  <files>code-arena/src/components/history/HistoryCard.tsx</files>
  <action>
    Create HistoryCard for history list:
    
    Props interface:
    - history: {
        _id: string
        problemTitle: string
        opponent: { username, avatar }
        result: 'win' | 'loss' | 'draw'
        score: number
        opponentScore: number
        date: string
        duration: number (seconds)
      }
    
    Layout:
    - Card with hover effect
    - Left: Problem title (bold)
    - Center: VS opponent with avatars
    - Right: Result badge + score
    - Bottom row: Date, Duration
    
    Result styling:
    - Win: Green badge "Victory", green border glow
    - Loss: Red badge "Defeat"
    - Draw: Gray badge "Draw"
    
    Score display:
    - "95 - 80" format
    - Winner score bold
    
    Hover:
    - Slight scale (1.02)
    - Shadow increase
    - Cursor pointer
    
    Click:
    - Navigate to /app/history/:id (detail view)
  </action>
  <verify>Card displays problem, opponent, result, clickable</verify>
  <done>History card component for competition list</done>
</task>

<task type="auto">
  <name>Build History page per RESEARCH.md pattern</name>
  <files>code-arena/src/pages/History.tsx</files>
  <action>
    Create History page at /app/history per RESEARCH.md competition history pattern:
    
    ```typescript
    import { useEffect, useState } from 'react';
    import { api } from '../lib/api';
    import { useAuth } from '../contexts/AuthContext';
    import { HistoryCard } from '../components/history/HistoryCard';
    
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
      winner: string | null; // userId of winner
    }
    
    export function HistoryPage() {
      const { user } = useAuth();
      const [matches, setMatches] = useState<MatchSummary[]>([]);
      const [isLoading, setIsLoading] = useState(true);
      const [filter, setFilter] = useState<'all' | 'wins' | 'losses'>('all');
      
      useEffect(() => {
        const fetchHistory = async () => {
          try {
            const response = await api.get('/api/v1/competition/history');
            setMatches(response.data.data.history);
          } catch (error) {
            console.error('Failed to fetch history:', error);
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
      
      // Stats calculation per RESEARCH.md
      const stats = {
        total: matches.length,
        wins: matches.filter(m => m.winner === user?.id).length,
        winRate: matches.length > 0 
          ? Math.round((matches.filter(m => m.winner === user?.id).length / matches.length) * 100)
          : 0,
        avgScore: matches.length > 0
          ? Math.round(matches.reduce((acc, m) => acc + m.myResult.score, 0) / matches.length)
          : 0
      };
      
      if (isLoading) {
        return (
          <div className="max-w-4xl mx-auto p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-gray-700 rounded w-1/3"></div>
              <div className="grid grid-cols-3 gap-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-24 bg-gray-700 rounded"></div>
                ))}
              </div>
            </div>
          </div>
        );
      }
      
      return (
        <div className="max-w-4xl mx-auto p-6">
          <h1 className="text-3xl font-bold mb-6">Competition History</h1>
          
          {/* Stats Overview */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-gray-500">Total Matches</div>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
              <div className="text-2xl font-bold text-green-500">{stats.winRate}%</div>
              <div className="text-gray-500">Win Rate</div>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
              <div className="text-2xl font-bold">{stats.avgScore}</div>
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
                    : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          
          {/* Match List */}
          <div className="space-y-4">
            {filteredMatches.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">🏆</div>
                <p className="text-gray-500 mb-4">No competitions found</p>
                <a 
                  href="/app/lobby" 
                  className="inline-block px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                >
                  Join a Room
                </a>
              </div>
            ) : (
              filteredMatches.map((match) => (
                <HistoryCard key={match._id} match={match} currentUserId={user?.id} />
              ))
            )}
          </div>
        </div>
      );
    }
    ```
    
    Features per RESEARCH.md:
    - Stats overview (total, win rate, avg score)
    - Filter tabs (all/wins/losses)
    - History cards with problem, opponent, result
    - Empty state with CTA to lobby
    - Dark theme support
    - Loading skeletons
    - Responsive layout (max-w-4xl)
    
    API Integration:
    - GET /api/v1/competition/history?page=1&limit=10
    - Returns only user's competitions (privacy enforced)
    - Supports pagination
  </action>
  <verify>Page fetches history from API, displays stats cards, filter tabs work, shows HistoryCard components</verify>
  <done>Competition history page per RESEARCH.md pattern with stats and filtering</done>
</task>

<task type="auto">
  <name>Create match end flow integration</name>
  <files>backend/src/services/match.service.js, code-arena/src/pages/Room.tsx</files>
  <action>
    Integrate match end with result modal:
    
    1. Backend (match.service.js):
       - endMatch(roomId):
         - Set room.status = 'completed'
         - Call mlService.predictWinner()
         - Create CompetitionHistory entry
         - Emit 'match_end' event to room with:
           - winner, player1, player2, scores, mlPrediction
    
    2. Frontend (Room.tsx):
       - Listen for 'match_end' socket event
       - On receive:
         - Set result state
         - Show ResultModal (isOpen: true)
         - Play confetti if current user is winner
       - Disable editor
       - Show "Match Complete" overlay
    
    3. Auto-end conditions:
       - Both players submitted
       - Timer reached 0
       - Host manually ended
    
    4. Spectator view:
       - Show result modal without confetti
       - "Spectator Mode" badge
  </action>
  <verify>Match end triggers modal, shows results, saves history</verify>
  <done>Match end flow integrated with result modal and history</done>
</task>

</tasks>

<verification>
- Result modal displays when match ends
- Winner, scores, comparison shown correctly
- Confetti plays for winner
- History page lists user's competitions only
- History cards show problem, opponent, result
- Privacy enforced (only participants see history)
- Match completion saves to history
</verification>

<success_criteria>
Match result modal displays winner with confetti animation, score breakdown, and time comparison. History page shows private competition history accessible only to participants, with statistics and filtering.
</success_criteria>

<output>
After completion, create `.planning/phases/frontend-integration/frontend-integration-11-SUMMARY.md`
</output>
