---
phase: lobby-fix
plan: '04'
type: execute
wave: 3
depends_on: [lobby-fix-02, lobby-fix-03]
files_modified:
  - backend/src/modules/rooms/room.controller.js
  - code-arena/src/pages/app/Lobby.tsx
  - code-arena/src/lib/api.ts
autonomous: true
user_setup: []

must_haves:
  truths:
    - Lobby displays list of all active public rooms
    - Users can filter rooms by mode (debug, bug-hunt, code-golf)
    - Users can search rooms by name or invite code
    - Join button works and adds player to room
    - Room updates in real-time (via polling or socket)
  artifacts:
    - path: code-arena/src/pages/app/Lobby.tsx
      provides: Lobby UI with room list, filters, search, join
    - path: backend/src/modules/rooms/room.controller.js
      provides: Get rooms with filtering and search
---

<objective>
Fix lobby functionality to properly display rooms, allow filtering/searching, and enable joining rooms.
</objective>

<execution_context>
@C:/Users/HP/.config/opencode/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@E:/Projects/DevWars/code-arena/src/pages/app/Lobby.tsx
@E:/Projects/DevWars/backend/src/modules/rooms/room.controller.js
@E:/Projects/DevWars/code-arena/src/lib/api.ts
</context>

<tasks>

<task type="auto">
  <name>Fix get rooms endpoint with filtering</name>
  <files>backend/src/modules/rooms/room.controller.js</files>
  <action>
    Update getRooms controller:
    - Support mode filter: ?mode=debug|bug-hunt|code-golf
    - Support status filter: ?status=waiting|playing|finished
    - Support search by room name or invite code: ?search=term
    - Only return non-finished rooms by default
    - Include player count in response (using virtual)
    - Sort by createdAt descending (newest first)
    - Populate createdBy and players.userId with username
  </action>
  <verify>GET /api/v1/lobby/rooms?mode=debug returns only debug rooms</verify>
  <done>Rooms endpoint properly filters and returns active rooms</done>
</task>

<task type="auto">
  <name>Fix join room endpoint</name>
  <files>backend/src/modules/rooms/room.controller.js</files>
  <action>
    Update joinRoom controller:
    - Check room exists (404 if not)
    - Check room status is 'waiting' (400 if playing/finished)
    - Check room is not full (400 if maxPlayers reached)
    - Check user not already in room (400 if already joined)
    - Add player to room with joinedAt timestamp
    - Save room and return updated room object
    - Include error handling for edge cases
  </action>
  <verify>User can join waiting room, gets 400 if room full or playing</verify>
  <done>Join room properly validates and adds player</done>
</task>

<task type="auto">
  <name>Fix leave room endpoint</name>
  <files>backend/src/modules/rooms/room.controller.js</files>
  <action>
    Update leaveRoom controller:
    - Check room exists (404 if not)
    - Check user is in room (400 if not)
    - Remove player from room
    - If room becomes empty, delete room (return success)
    - If host leaves, assign new host to first remaining player
    - Return updated room or success message
  </action>
  <verify>User can leave room, room deleted if empty, host transferred if host leaves</verify>
  <done>Leave room properly handles all cases</done>
</task>

<task type="auto">
  <name>Fix frontend lobby display and interactions</name>
  <files>code-arena/src/pages/app/Lobby.tsx</files>
  <action>
    Fix Lobby.tsx:
    - fetchData: call getRooms with mode filter
    - Handle empty rooms list (show "No rooms found" message)
    - Handle room full case (disable join button, show "Room Full")
    - Handle room playing (show "Spectate" button instead of "Join")
    - Filter rooms client-side by search query (name or inviteCode)
    - Mode filter buttons work correctly
    - Add refresh on successful join/leave
    
    Ensure filteredRooms correctly filters by searchQuery
  </action>
  <verify>Lobby shows rooms, filters work, join navigates to room</verify>
  <done>Lobby UI properly displays and interacts with rooms</done>
</task>

<task type="auto">
  <name>Add auto-refresh to lobby</name>
  <files>code-arena/src/pages/app/Lobby.tsx</files>
  <action>
    Update Lobby polling:
    - Poll every 5 seconds (already set in interval)
    - Add refresh token if needed before polling
    - Handle errors gracefully (don't crash on failed fetch)
    - Show loading state on initial load only
    
    Optional: Add socket.io for real-time updates (if socket is configured)
  </action>
  <verify>Lobby updates automatically without page refresh</verify>
  <done>Lobby stays up-to-date with room changes</done>
</task>

</tasks>

<verification>
- Rooms list displays from API
- Mode filter works
- Search works
- Join adds player to room
- Room state updates in lobby
</verification>

<success_criteria>
Lobby is fully functional: list, filter, search, join all work correctly
</success_criteria>

<output>
After completion, create `.planning/phases/lobby-fix/lobby-fix-04-SUMMARY.md`
</output>
