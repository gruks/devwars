---
phase: frontend-integration
plan: '12'
type: execute
wave: 1
depends_on: []
files_modified:
  - backend/src/modules/socket/handlers/room.js
  - backend/src/modules/socket/handlers/lobby.js
  - code-arena/src/pages/app/Lobby.tsx
  - code-arena/src/contexts/SocketContext.tsx
  - code-arena/src/pages/app/History.tsx
autonomous: true
gap_closure: true

must_haves:
  truths:
    - "Rooms are saved to MongoDB when created"
    - "Created rooms broadcast to all lobby users in real-time"
    - "Rooms visible to all lobby users for joining"
    - "History page accessible at /app/history"
  artifacts:
    - path: "backend/src/modules/socket/handlers/room.js"
      provides: "Room creation with MongoDB save verification"
    - path: "code-arena/src/pages/app/Lobby.tsx"
      provides: "Lobby with socket-based real-time updates"
    - path: "code-arena/src/pages/app/History.tsx"
      provides: "Competition history page"
  key_links:
    - from: "Lobby.tsx"
      to: "SocketContext"
      via: "socket.emit lobby:join"
      pattern: "socket\\.emit.*lobby:join"
    - from: "History.tsx"
      to: "/api/v1/competition/history"
      via: "api.get()"
      pattern: "api\\.get.*competition/history"
---

<objective>
Fix 4 diagnosed gaps from UAT: room MongoDB save, room broadcast visibility, and history page 404.
</objective>

<execution_context>
@C:/Users/HP/.config/opencode/get-shit-done/workflows/execute-plan.md
@C:/Users/HP/.config/opencode/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/frontend-integration/frontend-integration-UAT.md

# Root causes from diagnosis:

**Gap 1**: Room.create() exists but may fail silently on unique constraint violations (inviteCode)

**Gap 2**: Clients send lobby:join but if socket not yet connected, event fails silently

**Gap 3**: Same as Gap 2 - consequence of broadcast failure

**Gap 4**: History.tsx uses wrong API path `/api/v1/competition/history` but api.ts baseURL already includes `/api/v1`, so it calls `/api/v1/api/v1/competition/history` which returns 404
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix History page API path</name>
  <files>code-arena/src/pages/app/History.tsx</files>
  <action>
    Change line 52 from:
    `const response = await api.get('/api/v1/competition/history', {`
    to:
    `const response = await api.get('/competition/history', {`
    
    The axios instance already has baseURL `http://localhost:3000/api/v1`, so the full URL becomes correct.
  </action>
  <verify>
    Verify the change: grep "competition/history" History.tsx should show `/competition/history` not `/api/v1/competition/history`
  </verify>
  <done>
    History page no longer returns 404 - API endpoint is called correctly
  </done>
</task>

<task type="auto">
  <name>Task 2: Fix socket lobby:join connection timing</name>
  <files>code-arena/src/contexts/SocketContext.tsx</files>
  <action>
    In SocketContext.tsx, add a method to ensure socket is connected before emitting events, or modify the useEffect in Lobby.tsx to wait for socket connection:
    
    Option 1 - In SocketContext: Add isConnected check wrapper:
    ```typescript
    // Ensure socket is connected before emitting
    const safeEmit = (event: string, data?: unknown, callback?: (response: any) => void) => {
      if (!socket?.connected) {
        console.warn(`Socket not connected, cannot emit ${event}`);
        if (callback) callback({ success: false, error: 'Socket not connected' });
        return;
      }
      socket.emit(event, data, callback);
    };
    ```
    
    Option 2 - In Lobby.tsx useEffect (preferred): Add socket connection check before emitting lobby:join:
    
    Modify the useEffect that joins lobby to wait for connection:
    ```typescript
    useEffect(() => {
      if (!socket) return;
      
      // Wait for connection if not yet connected
      if (!isConnected) {
        const handleConnect = () => {
          socket.emit(SOCKET_EVENTS.LOBBY.JOIN, {}, (response: any) => {
            // ... existing handler
          });
        };
        socket.on('connect', handleConnect);
        return () => { socket.off('connect', handleConnect); };
      }
      
      // Already connected, proceed
      socket.emit(SOCKET_EVENTS.LOBBY.JOIN, {}, (response: any) => {
        // ... existing handler
      });
    }, [socket, isConnected]);
    ```
  </action>
  <verify>
    Check Lobby.tsx has logic to wait for socket connection before sending lobby:join
  </verify>
  <done>
    Users can see rooms created by other users in real-time
  </done>
</task>

<task type="auto">
  <name>Task 3: Add unique constraint error handling in room creation</name>
  <files>backend/src/modules/socket/handlers/room.js</files>
  <action>
    In the room creation handler (around line 33), wrap Room.create() in try/catch and specifically handle MongoDB duplicate key errors:
    
    After line 47 (after Room.create), add error handling:
    ```javascript
    } catch (error) {
      // Handle unique constraint violation (duplicate inviteCode)
      if (error.code === 11000) {
        logger.error(`Duplicate inviteCode generated for room creation, retrying...`);
        // Retry once with new inviteCode
        try {
          const retryRoom = await Room.create({
            ...data,
            inviteCode: generateUniqueInviteCode() // Different from default
          });
          // Continue with retryRoom...
        } catch (retryError) {
          throw new Error('Failed to create room after retry');
        }
      } else {
        throw error;
      }
    }
    ```
    
    Also add more verbose logging around Room.create() to capture exact MongoDB operations:
    - Log before Room.create() with the data being saved
    - Log after successful save with room._id
  </action>
  <verify>
    Check room.js has error handling for duplicate key errors (error.code === 11000)
  </verify>
  <done>
    Rooms are saved to MongoDB reliably without silent failures
  </done>
</task>

<task type="auto">
  <name>Task 4: Add reconnection handling for lobby rejoin</name>
  <files>code-arena/src/pages/app/Lobby.tsx</files>
  <action>
    In Lobby.tsx, modify the socket useEffect to rejoin lobby when socket reconnects:
    
    Add a socket 'connect' event listener that re-joins the lobby after reconnection:
    ```typescript
    useEffect(() => {
      if (!socket || !isConnected) return;
      
      // Existing: Join lobby and get initial data
      socket.emit(SOCKET_EVENTS.LOBBY.JOIN, {}, (response: any) => {
        // ... existing handler
      });
      
      // New: Rejoin lobby on reconnection
      const handleReconnect = () => {
        console.log('[Lobby] Socket reconnected, re-joining lobby');
        socket.emit(SOCKET_EVENTS.LOBBY.JOIN, {}, (response: any) => {
          if (response.success) {
            setRooms(response.data.rooms);
            setStats(response.data.stats);
          }
        });
      };
      
      socket.on('connect', handleReconnect);
      
      return () => {
        socket.off('connect', handleReconnect);
        // ... existing cleanup
      };
    }, [socket, isConnected]);
    ```
  </action>
  <verify>
    Check Lobby.tsx has reconnection handler for lobby:join
  </verify>
  <done>
    Rooms stay visible after socket reconnection
  </done>
</task>

</tasks>

<verification>
After fixes:
- Test 2: User login works
- Test 5: Create Room - room appears for all users in lobby
- Test 6: Join Room - room visible to other users
- Test 16: History page loads without 404
</verification>

<success_criteria>
All 4 gaps closed:
1. Rooms saved to MongoDB (Gap 1) - ✓ with error handling
2. Rooms broadcast to all lobby users (Gap 2) - ✓ with connection timing fix
3. Rooms visible to all users (Gap 3) - ✓ same fix
4. History page accessible (Gap 4) - ✓ with correct API path
</success_criteria>

<output>
After completion, create `.planning/phases/frontend-integration/frontend-integration-12-SUMMARY.md`
</output>
