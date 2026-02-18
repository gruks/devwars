---
phase: frontend-integration
plan: '07'
type: execute
wave: 1
depends_on:
  - frontend-integration-06
files_modified:
  - backend/src/socket/handlers/room.handlers.js
  - backend/src/socket/handlers/competition.handlers.js
  - backend/src/socket/middleware/room.middleware.js
  - backend/src/services/room.service.js
  - code-arena/src/contexts/SocketContext.tsx
  - code-arena/src/hooks/useRoomSync.ts
autonomous: true

must_haves:
  truths:
    - WebSocket rooms use socket.join(roomId) for proper scoping
    - Server-authoritative timer broadcasts every second to room
    - Code updates sync between both players in real-time
    - Opponent status updates (typing, running, submitted) work
    - On reconnect, client fetches full room state and syncs
    - Spectator join/leave updates count in real-time
  artifacts:
    - path: backend/src/socket/handlers/competition.handlers.js
      provides: Competition-specific socket events
      min_lines: 150
    - path: backend/src/socket/middleware/room.middleware.js
      provides: Room validation and state middleware
      min_lines: 60
    - path: code-arena/src/hooks/useRoomSync.ts
      provides: Frontend room synchronization hook
      min_lines: 80
  key_links:
    - from: competition.handlers.js
      to: room.service.js
      via: Fetch and update room state
      pattern: roomService.getRoom(roomId) for state
    - from: useRoomSync.ts
      to: SocketContext
      via: Socket.io client connection
      pattern: socket.on('timer_update', handler)
---

<objective>
Fix WebSocket room broadcasting to enable real-time synchronization between two players, server-authoritative timer, and spectator updates.

Purpose: Ensure both players see each other's progress, timer is synchronized, and the second player's screen works correctly.

Output: Fixed WebSocket handlers, new competition handlers, room sync middleware, frontend sync hook.
</objective>

<execution_context>
@C:/Users/HP/.config/opencode/get-shit-done/workflows/execute-plan.md
@C:/Users/HP/.config/opencode/get-shit-done/templates/summary.md
</execution_context>

<context>
@E:/Projects/DevWars/backend/src/socket/handlers/room.handlers.js
@E:/Projects/DevWars/backend/src/services/room.service.js
@E:/Projects/DevWars/code-arena/src/contexts/SocketContext.tsx
</context>

<tasks>

<task type="auto">
  <name>Create competition socket handlers</name>
  <files>backend/src/socket/handlers/competition.handlers.js</files>
  <action>
    Create new competition socket handlers file with events:
    
    1. competition:join_room
       - Validate room exists and user is participant
       - socket.join(roomId)
       - Emit current room state to joining socket
       - Broadcast 'player_joined' to room (excluding sender)
    
    2. competition:code_update
       - Validate user is room participant
       - Save lastCodeSnapshot to room
       - Broadcast 'opponent_code_update' to room (excluding sender) with:
         - userId, codeSnippet (first 100 chars), cursorPosition
    
    3. competition:run_code
       - Validate user is participant
       - Broadcast 'opponent_running' to room (excluding sender)
       - Call execution service (via Plan-08)
       - Broadcast 'run_result' to sender only with test results
    
    4. competition:submit_code
       - Validate user is participant
       - Lock editor for user
       - Broadcast 'opponent_submitted' to room (excluding sender)
       - Store submission metrics
       - Check if both submitted → trigger match end
    
    5. competition:timer_sync (server-initiated every second)
       - Calculate remainingTime = duration - (Date.now() - startTime)
       - io.to(roomId).emit('timer_update', { remainingTime, roomId })
    
    6. competition:spectator_join
       - Add user to spectators array
       - Broadcast 'spectator_count_update' to room
    
    7. competition:progress_update
       - Calculate progress from passedTestCases
       - Broadcast 'opponent_progress' to room
    
    All events use io.to(roomId).emit() or socket.to(roomId).emit() for proper room scoping.
  </action>
  <verify>All socket events use room-based broadcasting, handlers registered</verify>
  <done>Competition socket handlers created with proper room isolation</done>
</task>

<task type="auto">
  <name>Create room sync middleware</name>
  <files>backend/src/socket/middleware/room.middleware.js</files>
  <action>
    Create room middleware for socket connections:
    
    1. validateRoomAccess(socket, next)
       - Check socket.handshake.query.roomId exists
       - Verify room exists in database
       - Check user is participant OR spectator
       - Attach room to socket object: socket.room = room
       - Call next() or return error
    
    2. syncRoomState(socket)
       - On connection, fetch full room state:
         - Room details, participants, spectators, timer
         - Current submissions for both players
         - Test case results if submitted
       - Emit 'room_state_sync' to socket with full state
    
    3. handleReconnection(socket)
       - Check if user was previously connected to room
       - If yes, restore their lastCodeSnapshot
       - Sync current timer value
       - Emit 'reconnected' event with sync data
    
    Register middleware in socket/index.js to run before handlers.
  </action>
  <verify>Middleware validates room access, syncs state on connect</verify>
  <done>Room sync middleware validates and synchronizes room state</done>
</task>

<task type="auto">
  <name>Create useRoomSync frontend hook</name>
  <files>code-arena/src/hooks/useRoomSync.ts</files>
  <action>
    Create React hook for room synchronization:
    
    interface UseRoomSyncOptions {
      roomId: string;
      onTimerUpdate?: (remainingTime: number) => void;
      onOpponentCodeUpdate?: (data: OpponentCodeUpdate) => void;
      onOpponentRunning?: () => void;
      onOpponentSubmitted?: () => void;
      onOpponentProgress?: (progress: number) => void;
      onRunResult?: (result: RunResult) => void;
      onRoomStateSync?: (state: RoomState) => void;
    }
    
    Hook provides:
    - connect(): Join socket room
    - disconnect(): Leave socket room
    - emitCodeUpdate(code: string): Send code changes
    - emitRunCode(code: string, language: string): Request code execution
    - emitSubmitCode(code: string, language: string): Submit solution
    - isConnected: boolean
    - opponentStatus: 'idle' | 'typing' | 'running' | 'submitted'
    - opponentProgress: number (0-100)
    
    Use useEffect to:
    - Join room on mount
    - Set up socket event listeners
    - Clean up on unmount
    - Handle reconnection with room_state_sync
  </action>
  <verify>Hook connects to socket, listens for events, provides emit functions</verify>
  <done>Frontend room sync hook created for real-time updates</done>
</task>

<task type="auto">
  <name>Implement server-authoritative timer</name>
  <files>backend/src/services/room.service.js, backend/src/socket/handlers/competition.handlers.js</files>
  <action>
    Update room service and handlers for server-authoritative timer:
    
    1. In room.service.js add:
       - startTimer(roomId): Set room.startTime = Date.now(), start interval
       - stopTimer(roomId): Clear interval, set room.endTime
       - getRemainingTime(roomId): Calculate duration - elapsed
    
    2. In competition.handlers.js:
       - On competition:start_match event:
         - Call roomService.startTimer(roomId)
         - Set up setInterval to broadcast every 1000ms:
           ```
           const remaining = roomService.getRemainingTime(roomId);
           io.to(roomId).emit('timer_update', { 
             remainingTime: remaining, 
             totalTime: room.duration 
           });
           
           if (remaining <= 0) {
             clearInterval(timerInterval);
             io.to(roomId).emit('match_timeout');
             handleMatchEnd(roomId);
           }
           ```
    
    3. Store timerInterval reference in room object to clear on match end
    
    Client displays server time, never calculates locally.
  </action>
  <verify>Timer broadcasts every second, auto-ends on timeout, client syncs</verify>
  <done>Server-authoritative timer implemented with auto-end on expiry</done>
</task>

</tasks>

<verification>
- Socket rooms use proper join/leave with roomId
- Timer syncs every second from server
- Code updates broadcast to opponent
- Opponent status (typing/running/submitted) updates
- Reconnection restores room state
- Spectator count updates in real-time
- Second player receives all events correctly
</verification>

<success_criteria>
Both players in a room see each other's code updates, status changes, and share a synchronized timer. The second player's screen displays all real-time events correctly.
</success_criteria>

<output>
After completion, create `.planning/phases/frontend-integration/frontend-integration-07-SUMMARY.md`
</output>
