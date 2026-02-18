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
@E:/Projects/DevWars/backend/src/modules/competition/competitionHistory.model.js
@E:/Projects/DevWars/code-arena/src/pages
</context>

<tasks>

<task type="auto">
  <name>Create Result Modal component</name>
  <files>code-arena/src/components/room/ResultModal.tsx</files>
  <action>
    Create ResultModal for match completion:
    
    Props interface:
    - isOpen: boolean
    - onClose: () => void
    - result: {
        winner: { username, avatar, score }
        player1: { username, score, timeToSolve, passedTestCases }
        player2: { username, score, timeToSolve, passedTestCases }
        mlPrediction: { confidence, reasoning }
        problemTitle: string
      }
    - isWinner: boolean (current user)
    
    Layout:
    - Overlay: Semi-transparent dark background
    - Modal card: Centered, max-width 600px
    - Header: "🎉 Match Complete!" or "Match Over"
    - Winner section:
      - Large trophy icon (gold)
      - "Winner: {username}"
      - Winner's avatar
    - Score breakdown table:
      | Metric | You | Opponent |
      |--------|-----|----------|
      | Score | 95 | 80 |
      | Time | 5:23 | 8:45 |
      | Test Cases | 2/2 | 1/2 |
    - ML Prediction section:
      - "Winner determined by AI"
      - Confidence bar (0-100%)
      - Feature importance mini-chart
    - Bar chart comparison:
      - Horizontal bars for each metric
      - Your bar: blue, Opponent: gray
    - Actions:
      - "View History" button → navigate to /app/history
      - "Play Again" button → navigate to lobby
      - "Close" button
    
    Animations:
    - Modal fade in (300ms)
    - Trophy bounce on display
    - Numbers count up
    
    Confetti:
    - Trigger confetti if isWinner
    - Use canvas-confetti library
    - Duration: 3 seconds
    - Colors: gold, silver, primary blue
  </action>
  <verify>Modal displays winner, scores, comparison chart</verify>
  <done>Result modal with winner display and score breakdown</done>
</task>

<task type="auto">
  <name>Create Confetti animation component</name>
  <files>code-arena/src/components/room/Confetti.tsx</files>
  <action>
    Create reusable Confetti component:
    
    Install: canvas-confetti
    
    Props interface:
    - trigger: boolean (start animation when true)
    - duration?: number (default: 3000ms)
    - particleCount?: number (default: 150)
    - colors?: string[] (default: ['#FFD700', '#C0C0C0', '#3B82F6'])
    
    Implementation:
    - Use canvas-confetti library
    - Fire from center of screen
    - Spread: 360 degrees
    - Gravity: 1.2
    - Drift: 0
    - Ticks: 200
    
    Variants:
    - mode: 'celebration' (default) - full confetti burst
    - mode: 'subtle' - fewer particles, shorter duration
    - mode: 'winner' - gold emphasis, longer duration
    
    Cleanup:
    - Auto-stop after duration
    - Cancel animation on unmount
    
    Usage in ResultModal:
    - {isWinner && <Confetti trigger={isOpen} mode="winner" />}
  </action>
  <verify>Confetti animates when triggered, auto-cleans up</verify>
  <done>Confetti animation component for winner celebration</done>
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
  <name>Build History page</name>
  <files>code-arena/src/pages/History.tsx</files>
  <action>
    Create History page at /app/history:
    
    Layout:
    - Page header: "Competition History" + back button
    - Stats summary cards (top):
      - Total competitions: X
      - Win rate: X%
      - Best streak: X
      - Average score: X
    - Filter controls:
      - Search by opponent name
      - Filter by result: All | Wins | Losses
      - Sort by: Date | Score
    - History list:
      - Grid or list of HistoryCard components
      - Infinite scroll or pagination
      - Empty state: "No competitions yet"
    
    Data fetching:
    - useEffect: fetch history on mount
    - React Query or useState + useEffect
    - Pagination: page/limit state
    
    Loading state:
    - Skeleton cards while loading
    - Spinner for initial load
    
    Error state:
    - Retry button
    - Error message
    
    Styling:
    - Dark theme consistent with app
    - Container max-width 1200px
    - Responsive grid (1 col mobile, 2 col tablet, 3 col desktop)
    
    Empty state:
    - Icon: trophy or gamepad
    - Text: "You haven't competed yet"
    - CTA: "Join a Room" button → /app/lobby
  </action>
  <verify>Page fetches and displays history, filters work</verify>
  <done>Competition history page with stats and list</done>
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
