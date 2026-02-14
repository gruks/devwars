---
phase: lobby-fix
plan: '03'
type: execute
wave: 2
depends_on: [lobby-fix-01]
files_modified:
  - backend/src/modules/rooms/room.controller.js
  - backend/src/modules/rooms/room.model.js
  - code-arena/src/lib/api.ts
  - code-arena/src/pages/app/Lobby.tsx
autonomous: true
user_setup: []

must_haves:
  truths:
    - Players joining room are stored with exact join timestamp
    - Room state (waiting/playing/finished) is properly tracked
    - Host can start match which updates room status
    - Players can leave room and it's tracked
  artifacts:
    - path: backend/src/modules/rooms/room.model.js
      provides: Player storage with timestamps, room status management
    - path: backend/src/modules/rooms/room.controller.js
      provides: Join, leave, start match, end match endpoints
---

<objective>
Ensure database properly stores room values and player assignments with accurate timestamps. Implement complete room lifecycle: waiting -> playing -> finished.
</objective>

<execution_context>
@C:/Users/HP/.config/opencode/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@E:/Projects/DevWars/backend/src/modules/rooms/room.model.js
@E:/Projects/DevWars/backend/src/modules/rooms/room.controller.js
</context>

<tasks>

<task type="auto">
  <name>Add player join timestamp tracking</name>
  <files>backend/src/modules/rooms/room.model.js</files>
  <action>
    Ensure playerSchema has proper timestamp tracking:
    - joinedAt: { type: Date, default: Date.now } - auto-set on player join
    - Add lastActiveAt for tracking player activity
    
    Ensure addPlayer method:
    - Sets joinedAt to current Date when adding
    - Throws error if player already in room
    
    Ensure removePlayer method:
    - Logs the departure timestamp (optional)
  </action>
  <verify>Player.joinedAt is timestamp when player added to room</verify>
  <done>Player join times are accurately stored in database</done>
</task>

<task type="auto">
  <name>Implement start match functionality</name>
  <files>backend/src/modules/rooms/room.controller.js</files>
  <action>
    Add startMatch endpoint:
    - POST /api/v1/lobby/rooms/:id/start
    - Only room creator (host) can start the match
    - Validates at least 2 players are in room
    - Updates room status to 'playing'
    - Sets startedAt timestamp
    - Broadcasts via socket to all players
  </action>
  <verify>Host can start match, status changes to playing, startedAt is set</verify>
  <done>Room can transition from waiting to playing state</done>
</task>

<task type="auto">
  <name>Implement end match functionality</name>
  <files>backend/src/modules/rooms/room.controller.js</files>
  <action>
    Add endMatch endpoint:
    - POST /api/v1/lobby/rooms/:id/end
    - Only host or system can end match
    - Updates room status to 'finished'
    - Sets finishedAt timestamp
    - Updates player stats (wins/losses/rating)
    
    Add match results endpoint:
    - GET /api/v1/lobby/rooms/:id/results
    - Returns winner and player statistics after match
  </action>
  <verify>Match ends, finishedAt is set, stats are updated</verify>
  <done>Room can transition to finished state with results</done>
</task>

<task type="auto">
  <name>Update frontend room types and display</name>
  <files>code-arena/src/lib/api.ts, code-arena/src/pages/app/Lobby.tsx</files>
  <action>
    Update Room type in api.ts:
    - Add startedAt?: string
    - Add finishedAt?: string
    - Ensure player has: joinedAt, isReady
    
    Update Lobby.tsx:
    - Display player join times in room cards
    - Show time since created (e.g., "2 min ago")
    - Show waiting/playing/finished status properly
  </action>
  <verify>Room cards show player count and timestamps</verify>
  <done>Frontend properly displays room state and timestamps</done>
</task>

</tasks>

<verification>
- Room has waiting/playing/finished status
- Players join with timestamp recorded
- Match can be started and ended
- Stats are updated after match
</verification>

<success_criteria>
Room lifecycle is complete: create -> waiting -> playing -> finished with proper timestamps
</success_criteria>

<output>
After completion, create `.planning/phases/lobby-fix/lobby-fix-03-SUMMARY.md`
</output>
