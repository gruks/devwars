---
phase: frontend-integration
plan: 14
type: execute
wave: 1
depends_on: []
files_modified: ["src/components/Room.tsx", "src/components/Watch.tsx", "src/components/Lobby.tsx", "src/components/HistorySidebar.tsx", "src/cron/roomCleanup.js", "backend/src/cron/roomCleanup.js", "backend/src/models/Room.js"]
autonomous: true
must_haves:
  truths:
    - "Run Test button executes code and shows detailed test results with performance metrics"
    - "Submit button processes code with complexity analysis and stores results in MongoDB"
    - "Spectator window shows real-time code changes and player status"
    - "Rooms older than 1 day are automatically cleaned up from database"
    - "History sidebar displays recent matches with quick actions"
  artifacts:
    - path: "src/components/Room.tsx"
      provides: "Enhanced Run Test and Submit functionality with detailed feedback"
      min_lines: 50
    - path: "src/components/Watch.tsx"
      provides: "Real-time spectator window with code preview and player status"
      min_lines: 80
    - path: "src/components/HistorySidebar.tsx"
      provides: "Collapsible sidebar with recent match history"
      min_lines: 30
    - path: "src/cron/roomCleanup.js"
      provides: "Scheduled room cleanup for old rooms"
      min_lines: 20
    - path: "backend/src/cron/roomCleanup.js"
      provides: "Backend cron job for room cleanup"
      min_lines: 20
    - path: "backend/src/models/Room.js"
      provides: "Room model with enhanced cleanup logic"
      min_lines: 10
  key_links:
    - from: "src/components/Room.tsx"
      to: "/api/evaluate"
      via: "handleRunTests function"
      pattern: "handleRunTests.*api/evaluate"
    - from: "src/components/Room.tsx"
      to: "/api/submit"
      via: "handleSubmitSolution function"
      pattern: "handleSubmitSolution.*api/submit"
    - from: "src/components/Watch.tsx"
      to: "/api/room/{roomId}/spectate"
      via: "WebSocket connection"
      pattern: "socket\.connect.*spectate"
    - from: "src/components/Lobby.tsx"
      to: "/api/rooms/cleanup"
      via: "cron job execution"
      pattern: "cleanupOldRooms.*api/rooms/cleanup"
---

<objective>
Complete the frontend-integration phase by implementing production-grade features for the competitive coding platform.

Purpose: Add the final polish and functionality needed to make the application production-ready with enhanced user experience, real-time features, and proper maintenance.
Output: Complete frontend-integration phase with all plans executed and phase marked as complete.
</objective>

<execution_context>
@C:/Users/HP/.config/opencode/get-shit-done/workflows/execute-plan.md
@C:/Users/HP/.config/opencode/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md

# Current Implementation Analysis
@path/to/src/components/Room.tsx
@path/to/src/components/Watch.tsx  
@path/to/src/components/Lobby.tsx
@path/to/src/components/History.tsx
@path/to/backend/src/models/Room.js
@path/to/backend/src/cron/
</context>

<tasks>

<task type="auto">
  <name>Task 1: Enhance Room Component with Advanced Test & Submit Functionality</name>
  <files>src/components/Room.tsx</files>
  <action>
    Enhance the existing Room component with advanced test and submit functionality:
    
    **Run Test Button Enhancements:**
    - Add detailed test result visualization with pass/fail breakdown
    - Include performance metrics (execution time, memory usage) in test results
    - Add code quality analysis with suggestions for improvement
    - Implement test case filtering and search functionality
    - Show detailed error messages with line numbers and context
    - Add loading states and progress indicators during test execution
    
    **Submit Button Enhancements:**
    - Add real-time submission status updates with progress bars
    - Implement code complexity analysis (time/space complexity)
    - Add security vulnerability scanning with suggestions
    - Include best practices recommendations
    - Add automated feedback generation with improvement tips
    - Show submission history and previous attempts
    
    Reference existing handleRunTests() and handleSubmitSolution() functions and enhance them with the new features.
  </action>
  <verify>npm run test and verify that Room component compiles without errors</verify>
  <done>Room component has enhanced Run Test and Submit buttons with detailed feedback, performance metrics, and code quality analysis</done>
</task>

<task type="auto">
  <name>Task 2: Build Real-Time Spectator Window</name>
  <files>src/components/Watch.tsx</files>
  <action>
    Transform the basic Watch component into a full-featured spectator window:
    
    **Real-time Features:**
    - Add WebSocket connection for live updates using socket.io-client
    - Implement live code preview with syntax highlighting using Monaco Editor
    - Add player status panel showing who's typing, running tests, or submitted
    - Create chat system for spectators to communicate with each other
    - Add statistics dashboard with real-time match metrics
    - Implement live leaderboard with ranking updates
    
    **UI Components:**
    - Main spectator layout with code preview, player panel, and chat
    - Player cards with status indicators and avatars
    - Code diff viewer to show changes in real-time
    - Progress bars for test execution and submission
    - Notification system for match events
    
    **Socket Events:**
    - Listen for MATCH_UPDATE, CODE_CHANGE, PLAYER_STATUS, TIMER_UPDATE events
    - Broadcast spectator chat messages
    - Handle player join/leave events
    - Update UI in real-time based on socket events
    
    Reference existing Watch component and enhance it with real-time functionality.
  </action>
  <verify>npm run test and verify that Watch component compiles without errors</verify>
  <done>Spectator window shows real-time code changes, player status, and chat functionality with live updates</done>
</task>

<task type="auto">
  <name>Task 3: Implement Room Cleanup Cron Job</name>
  <files>backend/src/cron/roomCleanup.js, backend/src/models/Room.js</files>
  <action>
    Implement automatic room cleanup for old rooms:
    
    **Backend Cron Job:**
    - Create new file backend/src/cron/roomCleanup.js
    - Add function to find rooms older than 1 day with status 'finished'
    - Check for rooms with no active players or spectators
    - Delete old rooms from database to prevent bloat
    - Add error handling and logging for cleanup operations
    - Schedule the job to run daily using node-cron
    
    **Room Model Enhancements:**
    - Add indexes on createdAt and status fields for query performance
    - Add virtual fields for room age and cleanup eligibility
    - Add pre-remove hooks for cleanup logging
    - Add static methods for cleanup operations
    
    **Frontend Integration:**
    - Add cleanup status indicator in Lobby component
    - Handle cleanup errors gracefully in UI
    - Update room lists after cleanup operations
    - Add user notification for room cleanup
    
    Reference existing cron job patterns and Room model structure.
  </action>
  <verify>npm run test and verify that Room model compiles without errors</verify>
  <done>Automatic room cleanup runs daily, removing rooms older than 1 day with no active users</done>
</task>

<task type="auto">
  <name>Task 4: Create History Sidebar Component</name>
  <files>src/components/HistorySidebar.tsx, src/App.tsx</files>
  <action>
    Create a collapsible history sidebar component:
    
    **HistorySidebar Component:**
    - Create new file src/components/HistorySidebar.tsx
    - Fetch recent matches from /api/competition/history endpoint
    - Display match cards with key information (opponent, result, date, score)
    - Add quick actions (re-match, view details, share)
    - Implement filtering options (wins, losses, date ranges)
    - Add loading states and error handling
    - Make sidebar collapsible/expandable with smooth animations
    
    **Integration with Main Layout:**
    - Add HistorySidebar to src/App.tsx main layout
    - Position sidebar on the left side of the application
    - Add toggle button for sidebar visibility
    - Ensure responsive design for mobile devices
    - Add smooth transitions and hover effects
    
    **Data Integration:**
    - Use existing History.tsx component as data source
    - Add pagination for large match histories
    - Implement search functionality for matches
    - Add statistics display (total matches, win rate, etc.)
    
    Reference existing History component and create a sidebar version.
  </action>
  <verify>npm run test and verify that HistorySidebar component compiles without errors</verify>
  <done>Collapsible sidebar displays recent match history with quick actions and filtering options</done>
</task>

</tasks>

<verification>
- [ ] Room component has enhanced Run Test and Submit buttons with detailed feedback
- [ ] Spectator window shows real-time code changes and player status
- [ ] Automatic room cleanup runs daily for old rooms
- [ ] History sidebar displays recent matches with quick actions
- [ ] All components compile without errors
- [ ] WebSocket connections work properly for real-time features
- [ ] Database queries are optimized with proper indexes
- [ ] Error handling is implemented throughout the application
</verification>

<success_criteria>
Phase frontend-integration is complete when:
- All 4 tasks are implemented successfully
- Run Test and Submit buttons have advanced functionality with detailed feedback
- Spectator window provides real-time viewing experience
- Room cleanup cron job runs automatically and removes old rooms
- History sidebar is integrated into main layout with quick actions
- Application is production-ready with all features implemented
- No compilation errors exist in the codebase
- All WebSocket connections work properly
- Database performance is optimized
</success_criteria>

<output>
After completion, create `.planning/phases/frontend-integration/frontend-integration-14-SUMMARY.md`
</output>