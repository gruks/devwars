---
phase: frontend-integration
plan: '09'
type: execute
wave: 2
depends_on:
  - frontend-integration-07
  - frontend-integration-08
files_modified:
  - code-arena/src/pages/Room.tsx
  - code-arena/src/components/room/ProblemPanel.tsx
  - code-arena/src/components/room/CodeEditor.tsx
  - code-arena/src/components/room/TestCasePanel.tsx
  - code-arena/src/components/room/OpponentPanel.tsx
  - code-arena/src/components/room/Timer.tsx
  - code-arena/src/styles/room.css
autonomous: true

must_haves:
  truths:
    - Room page has LeetCode-style split layout
    - Problem panel shows title, difficulty, description, examples
    - Code editor is Monaco Editor with language selection
    - Run button executes code and shows test results
    - Submit button locks editor and finalizes submission
    - Opponent panel shows live status (typing/running/submitted)
    - Timer displays synchronized countdown
    - Test case panel shows pass/fail for 2 test cases
  artifacts:
    - path: code-arena/src/pages/Room.tsx
      provides: Main room page component
      min_lines: 150
    - path: code-arena/src/components/room/CodeEditor.tsx
      provides: Monaco editor wrapper
      min_lines: 80
    - path: code-arena/src/components/room/TestCasePanel.tsx
      provides: Test case results display
      min_lines: 60
  key_links:
    - from: Room.tsx
      to: useRoomSync.ts
      via: Hook usage
      pattern: const { emitRunCode, emitSubmitCode } = useRoomSync()
    - from: CodeEditor.tsx
      to: Monaco Editor
      via: @monaco-editor/react
      pattern: <Editor language={language} value={code} />
---

<objective>
Build LeetCode-style room page with problem panel, Monaco editor, test case results, opponent status, and synchronized timer.

Purpose: Provide competitive coding interface where users see problems, write code, run tests, and compete in real-time.

Output: Complete Room page with all panels, Monaco editor integration, test case display.
</objective>

<execution_context>
@C:/Users/HP/.config/opencode/get-shit-done/workflows/execute-plan.md
@C:/Users/HP/.config/opencode/get-shit-done/templates/summary.md
</execution_context>

<context>
@E:/Projects/DevWars/.planning/phases/frontend-integration/frontend-integration-RESEARCH.md
@E:/Projects/DevWars/code-arena/src/pages/Room.tsx
@E:/Projects/DevWars/code-arena/src/contexts/SocketContext.tsx
</context>

<tasks>

<task type="auto">
  <name>Create Problem Panel component</name>
  <files>code-arena/src/components/room/ProblemPanel.tsx</files>
  <action>
    Create ProblemPanel component with LeetCode-style layout:
    
    Props interface:
    - problem: { title, difficulty, description, constraints, examples }
    
    Layout:
    - Header: Title + Difficulty badge (green/yellow/red for easy/medium/hard)
    - Description: Problem statement with markdown rendering
    - Constraints: Bullet list of input constraints
    - Examples: Numbered examples with Input/Output/Explanation blocks
    
    Styling:
    - Dark theme (bg-gray-900, text-gray-100)
    - Scrollable content area
    - Code blocks with syntax highlighting for examples
    - Font: monospace for code, sans-serif for text
    
    Features:
    - Collapsible sections for mobile
    - Copy example input button
    - Tab navigation: Description | Editorial (placeholder)
  </action>
  <verify>Component renders problem with all sections, scrollable</verify>
  <done>Problem panel displays title, difficulty, description, examples</done>
</task>

<task type="auto">
  <name>Create Code Editor component with Monaco</name>
  <files>code-arena/src/components/room/CodeEditor.tsx</files>
  <action>
    Create CodeEditor component using Monaco Editor per RESEARCH.md Pattern 1:
    
    Install: @monaco-editor/react@^4.7.0
    
    Props interface:
    - code: string
    - language: string ('javascript' | 'python' | 'java' | 'go' | 'cpp')
    - onChange: (value: string) => void
    - onLanguageChange: (lang: string) => void
    - readOnly?: boolean
    - height?: string (default: "60vh")
    
    Implementation per RESEARCH.md Pattern 1:
    ```typescript
    import Editor from '@monaco-editor/react';
    import { useRef, useCallback } from 'react';
    
    export function CodeEditor({
      code,
      language,
      onChange,
      onLanguageChange,
      readOnly = false,
      height = "60vh"
    }: CodeEditorProps) {
      const editorRef = useRef(null);
      const monacoRef = useRef(null);
      
      const handleEditorDidMount = (editor, monaco) => {
        editorRef.current = editor;
        monacoRef.current = monaco;
        
        // Configure TypeScript/JavaScript defaults per RESEARCH.md
        monaco.languages.typescript.javascriptDefaults.setEagerModelSync(true);
        
        // Restore code from localStorage on mount
        const savedCode = localStorage.getItem(`room-${roomId}-code`);
        if (savedCode && !code) {
          editor.setValue(savedCode);
        }
      };
      
      const handleChange = useCallback((value) => {
        onChange(value || '');
        // Debounced save to localStorage
        localStorage.setItem(`room-${roomId}-code`, value || '');
      }, [onChange]);
      
      return (
        <Editor
          height={height}
          language={language}
          value={code}
          onChange={handleChange}
          onMount={handleEditorDidMount}
          theme="vs-dark"
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            scrollBeyondLastLine: false,
            automaticLayout: true,
            padding: { top: 16 },
            lineNumbers: "on",
            roundedSelection: false,
            readOnly: readOnly,
            scrollbar: {
              useShadows: false,
              verticalHasArrows: false,
              horizontalHasArrows: false,
              vertical: "auto",
              horizontal: "auto"
            }
          }}
        />
      );
    }
    ```
    
    Language dropdown: JavaScript, Python, Java, Go, C++
    
    Default code templates per language:
    - JavaScript: function solution(nums) {\n  // Write your code here\n  return result;\n}
    - Python: def solution(nums):\n    # Write your code here\n    pass
    - Java: public class Solution {\n    public int[] solution(int[] nums) {\n        // Write your code here\n        return result;\n    }\n}
    - Go: func solution(nums []int) []int {\n    // Write your code here\n    return result\n}
    - C++: #include <vector>\nusing namespace std;\n\nvector<int> solution(vector<int>& nums) {\n    // Write your code here\n    return result;\n}
    
    Toolbar:
    - Language selector dropdown
    - Settings gear (font size: 12/14/16/18)
    - Fullscreen toggle
    
    Keyboard shortcuts (per RESEARCH.md anti-patterns - use local state, not global):
    - Ctrl+Enter: Trigger onRun callback
    - Ctrl+S: Prevent default browser save, show "Auto-saved" toast
    
    Real-time sync:
    - onChange debounced (500ms) → emit 'competition:code_update' via useRoomSync
    - Send only first 100 chars to opponent for preview
    
    Performance optimization (per RESEARCH.md):
    - Use useCallback for onChange handler
    - Don't store editor content in global state (Redux/Zustand)
    - Keep in local state + localStorage only
  </action>
  <verify>Monaco editor renders with vs-dark theme, language switch works, onChange emits debounced updates, localStorage persistence works</verify>
  <done>Monaco code editor per RESEARCH.md Pattern 1 with optimized configuration</done>
</task>

<task type="auto">
  <name>Create Test Case Panel component</name>
  <files>code-arena/src/components/room/TestCasePanel.tsx</files>
  <action>
    Create TestCasePanel component for displaying results:
    
    Props interface:
    - results: Array<{
        index: number;
        passed: boolean;
        input: string;
        expectedOutput: string;
        actualOutput: string;
        executionTime: number;
        error?: string;
      }>
    - isRunning: boolean
    
    Layout:
    - Tabs: "Testcase" | "Test Result"
    - Test Case view:
      - Two clickable test case buttons: "Case 1", "Case 2"
      - Selected case shows:
        - Input: <pre> with copy button
        - Expected Output: <pre>
        - (Only visible if results available)
    - Test Result view:
      - Status header: "Accepted" (green) or "Wrong Answer" (red)
      - Runtime: X ms
      - Memory: X MB
      - Per-test breakdown:
        - Test case number + status icon (✓/✗)
        - Input, Expected, Actual columns
        - Error message if any
    
    Styling:
    - Dark theme matching LeetCode
    - Green checkmarks for passed
    - Red X for failed
    - Yellow spinner while running
  </action>
  <verify>Panel shows test cases, switches between input and results</verify>
  <done>Test case panel displays input/output and pass/fail status</done>
</task>

<task type="auto">
  <name>Create Opponent Panel component</name>
  <files>code-arena/src/components/room/OpponentPanel.tsx</files>
  <action>
    Create OpponentPanel showing competitor status:
    
    Props interface:
    - opponent: { username, avatar, status, progress }
    - opponentCode?: string (first 100 chars only)
    
    Layout:
    - Header: "Opponent" + live indicator (green dot pulsing)
    - Avatar + Username display
    - Status indicator:
      - 🟡 Typing... (when receiving code_update)
      - 🔵 Running... (when opponent clicked Run)
      - 🟣 Submitted (when opponent submitted)
      - ✅ Passed X/2 (when test results received)
    - Progress bar: 0-100% based on passedTestCases
    - Mini code preview: Show first 3 lines of opponent's code
      - Syntax highlighted
      - Updates in real-time (throttled)
    - Spectator count: "👥 X watching"
    
    Styling:
    - Compact panel on right side
    - Dark theme
    - Smooth transitions for status changes
    
    Status mapping:
    - code_update → "typing" (with debounce to "idle" after 3s)
    - run_code → "running"
    - submit_code → "submitted"
  </action>
  <verify>Panel shows opponent status, updates in real-time</verify>
  <done>Opponent panel displays live competitor status and progress</done>
</task>

<task type="auto">
  <name>Create Timer component</name>
  <files>code-arena/src/components/room/Timer.tsx</files>
  <action>
    Create Timer component with synchronized countdown:
    
    Props interface:
    - remainingTime: number (seconds)
    - totalTime: number (seconds)
    - isActive: boolean
    
    Display:
    - MM:SS format (e.g., "15:00")
    - Color changes based on time:
      - > 60s: white text
      - 30-60s: yellow text
      - < 30s: red text + pulse animation
    - Progress bar: (remainingTime / totalTime) * 100%
    
    Styling:
    - Monospace font for numbers
    - Large, readable size
    - Background bar showing progress
    - Centered in top bar
    
    Behavior:
    - Display only (no local countdown)
    - Updates when receiving 'timer_update' event
    - Shows "Time's Up!" when remainingTime <= 0
  </action>
  <verify>Timer displays MM:SS, color changes, progress bar updates</verify>
  <done>Timer component shows synchronized countdown</done>
</task>

<task type="auto">
  <name>Build main Room page layout</name>
  <files>code-arena/src/pages/Room.tsx, code-arena/src/styles/room.css</files>
  <action>
    Build main Room page with LeetCode-style layout:
    
    URL: /app/room/:roomId
    
    Layout structure:
    ```
    -----------------------------------------------
    | TopBar: Room ID | Timer | Spectators | Exit |
    -----------------------------------------------
    | Problem Panel | Code Editor | Opponent Panel |
    | (resizable)   | (resizable) | (fixed width)  |
    -----------------------------------------------
    | Console / Test Case Panel                   |
    -----------------------------------------------
    ```
    
    TopBar:
    - Room ID: Copyable room code
    - Timer: Timer component (center)
    - Spectators: Eye icon + count
    - Exit: Leave room button
    
    Main area (using CSS Grid or Split.js):
    - Left: ProblemPanel (30%, min 300px)
    - Center: CodeEditor (flex: 1)
    - Right: OpponentPanel (250px fixed)
    - Resizable dividers between panels
    
    Bottom: TestCasePanel (200px height, collapsible)
    
    Actions:
    - Run button (bottom of editor): 
      - Calls POST /api/v1/execution/run
      - Shows results in TestCasePanel
    - Submit button (primary, next to Run):
      - Calls POST /api/v1/execution/submit
      - Locks editor
      - Shows confirmation
    
    State management:
    - Use useRoomSync hook for socket events
    - Track: code, language, testResults, opponentStatus, timer
    - Auto-save code to localStorage
    
    CSS:
    - Dark theme (bg-gray-900)
    - No external margins (fullscreen feel)
    - Smooth transitions
    - Scrollbars styled for dark theme
  </action>
  <verify>Room page renders all panels, layout is responsive</verify>
  <done>Complete room page with LeetCode-style layout</done>
</task>

</tasks>

<verification>
- Room page accessible at /app/room/:roomId
- Problem panel displays correctly
- Monaco editor loads with syntax highlighting
- Language dropdown switches languages
- Run button executes code, shows results
- Submit button locks editor
- Opponent panel shows live status
- Timer syncs from server
- Test case panel shows pass/fail
- Layout is resizable
</verification>

<success_criteria>
LeetCode-style room page with split layout: problem description, Monaco editor, opponent status panel, test case results, and synchronized timer. Users can write code, run tests, and see competitor progress in real-time.
</success_criteria>

<output>
After completion, create `.planning/phases/frontend-integration/frontend-integration-09-SUMMARY.md`
</output>
