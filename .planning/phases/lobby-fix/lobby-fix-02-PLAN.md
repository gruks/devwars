---
phase: lobby-fix
plan: '02'
type: execute
wave: 2
depends_on: [lobby-fix-01]
files_modified:
  - backend/src/modules/rooms/room.controller.js
  - backend/src/modules/rooms/room.model.js
  - backend/src/modules/rooms/room.routes.js
  - code-arena/src/pages/app/Lobby.tsx
  - code-arena/src/lib/api.ts
autonomous: true
user_setup: []

must_haves:
  truths:
    - Users can create a room with custom settings (name, mode, difficulty, timer)
    - Created room appears in lobby immediately
    - User becomes host (creator) of the room
    - Room is saved to database with all settings
  artifacts:
    - path: backend/src/modules/rooms/room.controller.js
      provides: Create room endpoint with validation
    - path: code-arena/src/pages/app/Lobby.tsx
      provides: Create room modal and API call
---

<objective>
Fix the create room flow end-to-end: frontend creates room -> backend saves to MongoDB -> room appears in lobby.
</objective>

<execution_context>
@C:/Users/HP/.config/opencode/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@E:/Projects/DevWars/backend/src/modules/rooms/room.controller.js
@E:/Projects/DevWars/backend/src/modules/rooms/room.model.js
@E:/Projects/DevWars/code-arena/src/pages/app/Lobby.tsx
@E:/Projects/DevWars/code-arena/src/lib/api.ts
</context>

<tasks>

<task type="auto">
  <name>Verify and fix room model for timestamps</name>
  <files>backend/src/modules/rooms/room.model.js</files>
  <action>
    Ensure Room model has:
    - createdAt timestamp (auto by timestamps: true)
    - players array with joinedAt for each player (already has default: Date.now)
    - startedAt and finishedAt for match timing
    
    Verify playerSchema has joinedAt: { type: Date, default: Date.now }
  </action>
  <verify>Room.save() includes timestamps, player.joinedAt is set on addPlayer</verify>
  <done>Room model properly stores createdAt and player joinedAt timestamps</done>
</task>

<task type="auto">
  <name>Fix create room endpoint validation</name>
  <files>backend/src/modules/rooms/room.controller.js</files>
  <action>
    Update createRoom controller:
    - Validate required fields: name (optional, auto-generate if missing), mode, maxPlayers
    - Validate mode is one of: 'debug', 'bug-hunt', 'code-golf'
    - Validate maxPlayers is 2-6
    - Validate difficulty: 'easy', 'medium', 'hard', 'extreme'
    - Validate timer: 10, 15, 20, 30 minutes
    - Validate skillLevel based on user's rating (or default to 'intermediate')
    - Get user from req.user (set by authenticate middleware)
    - Auto-generate name if not provided: "Room-{random6chars}"
    - Add error handling for duplicate invite codes
  </action>
  <verify>POST /api/v1/lobby/rooms with valid data returns 201 with room object</verify>
  <done>Create room endpoint properly validates input and creates room</done>
</task>

<task type="auto">
  <name>Add skill level auto-detection</name>
  <files>backend/src/modules/rooms/room.controller.js</files>
  <action>
    Update createRoom to auto-detect skillLevel based on creator's rating:
    - rating >= 1600: 'expert'
    - rating >= 1300: 'advanced'
    - rating >= 1000: 'intermediate'
    - rating < 1000: 'beginner'
    
    Store creator's skill level as room's skillLevel
  </action>
  <verify>Room created with skillLevel matching creator's rating bracket</verify>
  <done>Room skill level is automatically determined</done>
</task>

<task type="auto">
  <name>Update frontend create room flow</name>
  <files>code-arena/src/pages/app/Lobby.tsx</files>
  <action>
    Fix Lobby.tsx create room handling:
    - Validate room name is not empty (show error if empty)
    - Pass all form fields to API: name, mode, maxPlayers, isPrivate, difficulty, timer
    - Handle success: navigate to room page with room ID
    - Handle error: show toast with error message
    - Add loading state during creation
    
    Ensure handleCreateRoom:
    - Validates newRoom.name is not empty before API call
    - Shows error toast if name is empty
    - Properly handles the response.data._id for navigation
  </action>
  <verify>Creating room from UI: fills form -> clicks create -> navigates to room</verify>
  <done>Create room modal works end-to-end</done>
</task>

</tasks>

<verification>
- Create room with all settings saves to MongoDB
- Room appears in lobby list
- Player is added as host with timestamp
- Navigation to room works after creation
</verification>

<success_criteria>
Users can create rooms with custom settings that are saved to database and appear in lobby
</success_criteria>

<output>
After completion, create `.planning/phases/lobby-fix/lobby-fix-02-SUMMARY.md`
</output>
