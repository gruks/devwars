---
phase: frontend-integration
plan: '06'
type: execute
wave: 1
depends_on: []
files_modified:
  - backend/src/modules/rooms/room.model.js
  - backend/src/modules/competition/competitionHistory.model.js
  - backend/src/modules/matches/match.model.js
  - backend/src/database/migrations/001_add_room_testcases.js
autonomous: true

must_haves:
  truths:
    - Room model includes testCases array with input/output pairs
    - Room model supports spectators array for viewers
    - Room model tracks competition progress with submissions array
    - CompetitionHistory collection exists for storing match results
    - CompetitionHistory is queryable by participants field for privacy
    - Match model stores code execution results and metrics
  artifacts:
    - path: backend/src/modules/rooms/room.model.js
      provides: Updated Room schema with testCases, spectators, enhanced submissions
      min_lines: 120
    - path: backend/src/modules/competition/competitionHistory.model.js
      provides: CompetitionHistory schema for storing private match results
      min_lines: 50
    - path: backend/src/modules/matches/match.model.js
      provides: Updated Match schema with code execution metrics
      min_lines: 100
  key_links:
    - from: room.model.js
      to: competitionHistory.model.js
      via: Room completion triggers CompetitionHistory creation
      pattern: room.status === 'completed' → save to history
    - from: room.model.js
      to: match.model.js
      via: Room stores matchId reference
      pattern: room.matchId references Match collection
---

<objective>
Update MongoDB schemas to support LeetCode-style competitive coding room with test cases, spectators, and competition history.

Purpose: Enable the backend to store test cases, track spectator count, store submission metrics, and maintain private competition history.

Output: Updated Room model, new CompetitionHistory model, updated Match model with execution metrics.
</objective>

<execution_context>
@C:/Users/HP/.config/opencode/get-shit-done/workflows/execute-plan.md
@C:/Users/HP/.config/opencode/get-shit-done/templates/summary.md
</execution_context>

<context>
@E:/Projects/DevWars/backend/src/modules/rooms/room.model.js
@E:/Projects/DevWars/backend/src/modules/matches/match.model.js
</context>

<tasks>

<task type="auto">
  <name>Update Room model with test cases and spectators</name>
  <files>backend/src/modules/rooms/room.model.js</files>
  <action>
    Update Room model schema to add:
    1. testCases array with fields: input (String), output (String), isHidden (Boolean, default: true)
    2. spectators array of ObjectIds referencing User model
    3. Enhanced submissions array with:
       - userId (ObjectId, ref: User)
       - timeToSolve (Number, seconds)
       - timeComplexity (String, e.g., "O(n)")
       - spaceComplexity (String, e.g., "O(1)")
       - passedTestCases (Number, 0-2)
       - totalTestCases (Number, default: 2)
       - codeSnapshot (String, full code)
       - submittedAt (Date)
    4. progress field (Number, 0-100, default: 0) - calculated field
    5. Add virtual field 'spectatorCount' that returns spectators.length
    6. Add methods: addSpectator(userId), removeSpectator(userId), calculateProgress()
    
    Keep existing fields: roomId, name, mode, status, problemId, participants, host, inviteCode, skillLevel, maxPlayers, createdAt, etc.
  </action>
  <verify>Room model schema includes all new fields, virtuals work correctly</verify>
  <done>Room model supports test cases, spectators, and enhanced submissions</done>
</task>

<task type="auto">
  <name>Create CompetitionHistory model</name>
  <files>backend/src/modules/competition/competitionHistory.model.js</files>
  <action>
    Create new CompetitionHistory model with schema:
    - roomId (String, required) - the room identifier
    - matchId (ObjectId, ref: Match, required)
    - participants (Array of ObjectIds, ref: User, required) - only these users can view
    - winner (ObjectId, ref: User) - null if draw/tie
    - problemId (ObjectId, ref: Question)
    - results (Array of):
      - userId (ObjectId, ref: User)
      - score (Number, 0-100)
      - timeToSolve (Number, seconds)
      - passedTestCases (Number, 0-2)
      - timeComplexity (String)
      - spaceComplexity (String)
    - features (Array of) - ML features used for prediction:
      - userId (ObjectId, ref: User)
      - timeComplexityScore (Number, 1-5)
      - spaceComplexityScore (Number, 1-5)
      - testCasesPassed (Number, 0-2)
      - constraintDifficulty (Number, 1-5)
      - timeToSolve (Number, seconds)
    - mlPrediction (Object):
      - predictedWinner (ObjectId, ref: User)
      - confidence (Number, 0-1)
      - modelVersion (String)
    - startedAt (Date)
    - endedAt (Date)
    - createdAt (Date, default: Date.now)
    
    Add static method: findForUser(userId) - returns history where participants includes userId
    Add index on participants field for efficient querying
  </action>
  <verify>CompetitionHistory model exports correctly, static method works</verify>
  <done>CompetitionHistory model created with privacy controls</done>
</task>

<task type="auto">
  <name>Update Match model with execution metrics</name>
  <files>backend/src/modules/matches/match.model.js</files>
  <action>
    Update existing Match model to add:
    1. Enhanced submissions array with execution metrics:
       - executionTime (Number, milliseconds)
       - memoryUsed (Number, MB)
       - testResults (Array of):
         - testCaseIndex (Number, 0-1)
         - passed (Boolean)
         - actualOutput (String)
         - expectedOutput (String)
         - executionTime (Number, ms)
    2. spectatorCount (Number, default: 0) - synced from room
    3. Add method: updateSpectatorCount(count) - updates spectator count
    4. Add method: calculateScores() - recalculates all player scores based on test results
    
    Ensure backward compatibility with existing match documents.
  </action>
  <verify>Match model includes new fields, methods work correctly</verify>
  <done>Match model stores detailed execution metrics</done>
</task>

</tasks>

<verification>
- Room model has testCases, spectators, enhanced submissions
- CompetitionHistory model exists and is importable
- CompetitionHistory.findForUser(userId) returns only user's competitions
- Match model has execution metrics fields
- All schemas are valid Mongoose schemas
- No breaking changes to existing code
</verification>

<success_criteria>
MongoDB schemas updated to support LeetCode-style competition with test cases, spectators tracking, and private competition history accessible only to participants.
</success_criteria>

<output>
After completion, create `.planning/phases/frontend-integration/frontend-integration-06-SUMMARY.md`
</output>
