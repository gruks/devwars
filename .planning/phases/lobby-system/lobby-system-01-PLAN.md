---
phase: lobby-system
plan: '01'
type: execute
wave: 1
depends_on: []
files_modified:
  - backend/src/modules/rooms/room.model.js
  - backend/src/modules/rooms/room.routes.js
  - backend/src/modules/rooms/room.controller.js
  - backend/src/routes.js
  - backend/src/server.js
  - backend/src/config/socket.js
autonomous: true

must_haves:
  truths:
    - Users can view list of active rooms
    - Users can create new rooms with settings
    - Users can join existing rooms
    - Users can see online player count
    - Real-time updates when rooms change
  artifacts:
    - path: backend/src/modules/rooms/room.model.js
      provides: Room Mongoose model
    - path: backend/src/modules/rooms/room.routes.js
      provides: Room API endpoints
    - path: backend/src/config/socket.js
      provides: Socket.io lobby events
---

<objective>
Build the lobby system backend - Room model, API endpoints, and Socket.io events for real-time multiplayer features.
</objective>

<execution_context>
@C:/Users/HP/.config/opencode/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@E:/Projects/DevWars/backend/src/modules/users/user.model.js
</context>

<tasks>

<task type="auto">
  <name>Create Room model</name>
  <files>backend/src/modules/rooms/room.model.js</files>
  <action>
    Create Room mongoose model with:
    - name: string, required
    - mode: enum ['debug'], default 'debug'
    - players: array of { userId, username, joinedAt }
    - maxPlayers: number, default 4
    - status: enum ['waiting', 'playing', 'finished'], default 'waiting'
    - skillLevel: string (average rank)
    - isPrivate: boolean, default false
    - inviteCode: string, unique
    - createdBy: objectId ref User
    - createdAt: timestamp
    - Methods: addPlayer, removePlayer, isFull, startMatch, endMatch
  </action>
  <verify>Room model exports correctly, can create rooms</verify>
  <done>Room model created with all required fields</done>
</task>

<task type="auto">
  <name>Create Room controller and routes</name>
  <files>backend/src/modules/rooms/room.controller.js, backend/src/modules/rooms/room.routes.js</files>
  <action>
    Create room.controller.js with:
    - getRooms() - list all active rooms, optional filters
    - createRoom() - create new room with settings
    - joinRoom() - join existing room
    - leaveRoom() - leave current room
    - getRoom() - get room details
    
    Create room.routes.js with:
    - GET /rooms - list rooms
    - POST /rooms - create room
    - POST /rooms/:id/join - join room
    - POST /rooms/:id/leave - leave room
    - GET /rooms/:id - get room details
    - GET /rooms/online - get online count
  </action>
  <verify>All endpoints return correct responses</verify>
  <done>Room API endpoints created and working</done>
</task>

<task type="auto">
  <name>Setup Socket.io for lobby</name>
  <files>backend/src/config/socket.js</files>
  <action>
    Create socket.io config with:
    - Connection handling
    - LOBBY_JOIN - user joins lobby
    - LOBBY_LEAVE - user leaves lobby
    - ROOM_CREATE - room created broadcast
    - ROOM_JOIN - user joins room
    - ROOM_LEAVE - user leaves room
    - ROOM_UPDATE - room state changed
    - PLAYER_ONLINE/PLAYER_OFFLINE - status updates
    - Track connected users in Map
  </action>
  <verify>Socket connects and events fire correctly</verify>
  <done>Socket.io lobby events working</done>
</task>

<task type="auto">
  <name>Mount routes and socket in server</name>
  <files>backend/src/routes.js, backend/src/server.js</files>
  <action>
    Update routes.js to mount /lobby routes
    Update server.js to initialize socket.io with HTTP server
  </action>
  <verify>Routes accessible, socket connected</verify>
  <done>Server properly configured</done>
</task>

</tasks>

<verification>
- GET /api/v1/lobby/rooms returns room list
- POST /api/v1/lobby/create creates room
- POST /api/v1/lobby/rooms/:id/join joins room
- Socket events fire on room changes
</verification>

<success_criteria>
Users can view rooms, create rooms, join rooms via API and socket
</success_criteria>
