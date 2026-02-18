# Secure Code Execution Sandbox

This service provides a secure environment for executing untrusted code in isolated Docker containers.

## Features

- Multi-language support (JavaScript, Python, Java, Go, C++)
- Resource limits (CPU, memory, process count)
- Network isolation (no internet access)
- Timeout enforcement (max 2 seconds)
- Memory limit (256MB)
- Read-only filesystem where possible

## Quick Start

```bash
# Build the sandbox image
docker build -f Dockerfile.sandbox -t devwars-sandbox .

# Start the sandbox service
docker-compose up -d

# Test execution
curl -X POST http://localhost:3000/api/execute \
  -H "Content-Type: application/json" \
  -d '{"language": "javascript", "code": "console.log(1+1)", "timeout": 1000}'
```

## API Endpoints

### POST /api/execute

Execute code in sandbox.

**Request Body:**
```json
{
  "language": "javascript",
  "code": "console.log('Hello')",
  "input": "",
  "timeout": 2000
}
```

**Response:**
```json
{
  "success": true,
  "stdout": "Hello\n",
  "stderr": "",
  "runtime": "15ms",
  "memory": "32mb",
  "status": "success"
}
```

### GET /health

Health check endpoint.

## Security

The sandbox provides:
- No network access (--network none)
- 256MB memory limit
- 0.5 CPU limit
- 50 process limit
- Read-only filesystem
- No new privileges
- tmpfs for /tmp (noexec, nosuid)

## Supported Languages

| Language | Version | Command |
|----------|---------|---------|
| JavaScript | Node.js 18 | `node` |
| Python | Python 3 | `python3` |
| Java | OpenJDK 11 | `javac` + `java` |
| Go | Go 1.x | `go run` |
| C++ | GCC | `g++` |

## File Structure

```
sandbox-service/
├── Dockerfile.sandbox      # Secure container definition
├── docker-compose.yml     # Service orchestration
├── package.json           # Node.js dependencies
├── src/
│   ├── index.js          # Express server
│   ├── routes/
│   │   └── execute.js    # Execution endpoints
│   └── executors/
│       └── sandbox.js    # Docker sandbox executor
└── scripts/
    └── entrypoint.sh     # Container entrypoint
```
