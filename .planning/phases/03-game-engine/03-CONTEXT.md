# Phase Context: Game Engine (Debug Battle)

## Decisions

### Compiler Integration
- **Execution Environment**: Docker-based sandbox (compilers/sandbox-service)
- **API Endpoint**: POST http://localhost:3000/api/execute
- **Request Format**: `{ language, code, timeout }`
- **Supported Languages**: python, node, java, go, cpp

### Question Format
- **Storage**: MongoDB (questions collection)
- **Format**: JSON with fields: id, mode, title, description, language, difficulty, starterCode, solution, testcases[], timeLimit, memoryLimit
- **Testcase Structure**: `{ input, output }` array

### Testcase Evaluation
- **Engine**: Iterate through testcases, run code with input, compare output
- **Execution**: Use sandbox-service API for isolated execution
- **Comparison**: Exact string match (trim whitespace)

### Battle Flow
- **Mode**: Debug mode - fix buggy code
- **Timer**: Synchronized across players
- **Submission**: Code submitted, evaluated against test cases
- **Scoring**: Based on test cases passed, time taken

## Claude's Discretion

- Question difficulty distribution (easy/medium/hard ratios)
- Number of starter questions to seed
- Timer duration defaults
- Scoring algorithm details

## Deferred Ideas

- Multiple choice questions (not in scope for MVP)
- Custom testcase input (stdin only for now)
- Code comparison/similarity detection
