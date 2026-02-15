"# Sandbox Service - Quick Reference

## 🚀 Quick Start Commands

```bash
# 1. Build runner images
./build-runners.sh

# 2. Start all services
docker-compose up -d

# 3. Check health
curl http://localhost:3000/health

# 4. Run tests
./test-api.sh

# 5. View logs
docker-compose logs -f

# 6. Stop services
docker-compose down
```

---

## 📡 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Service health check |
| `/api/execute` | POST | Execute code |
| `/api/languages` | GET | List supported languages |
| `/api/queue/stats` | GET | Queue statistics |

---

## 💻 Execute Code

```bash
curl -X POST http://localhost:3000/api/execute \
  -H \"Content-Type: application/json\" \
  -d '{
    \"language\": \"python\",
    \"code\": \"print(\\"Hello\\")\",
    \"timeout\": 2000
  }'
```

**Response:**
```json
{
  \"status\": \"success\",
  \"stdout\": \"Hello\",
  \"stderr\": \"\",
  \"runtime\": \"45ms\",
  \"memory\": \"12mb\"
}
```

---

## 🔧 Configuration (.env)

```bash
NODE_ENV=production
PORT=3000
REDIS_HOST=redis
REDIS_PORT=6379
EXECUTION_TIMEOUT=2000
CPU_LIMIT=0.5
MEMORY_LIMIT=128m
MAX_CONCURRENT_JOBS=10
LOG_LEVEL=info
```

---

## 🐳 Docker Commands

```bash
# Build service
docker build -t sandbox-service .

# Build specific runner
docker build -t sandbox-python-runner runners/python-runner/

# List runner images
docker images | grep sandbox

# Remove all containers
docker-compose down -v

# Scale workers
docker-compose up -d --scale sandbox-worker=5
```

---

## 📊 Monitoring

```bash
# View API logs
docker-compose logs -f sandbox-service

# View worker logs
docker-compose logs -f sandbox-worker

# View Redis logs
docker-compose logs -f redis

# Queue statistics
curl http://localhost:3000/api/queue/stats
```

---

## 🔐 Security Features

✅ Non-root user (sandbox:1000)  
✅ No network access  
✅ Read-only filesystem  
✅ CPU limit: 0.5 core  
✅ Memory limit: 128MB  
✅ Timeout: 2 seconds  
✅ Auto container cleanup  
✅ Seccomp + AppArmor  

---

## 🌐 Supported Languages

| Language | Runtime | Compile Time |
|----------|---------|--------------|
| Python | ~120ms | - |
| JavaScript | ~95ms | - |
| C++ | ~450ms | Yes |
| Java | ~850ms | Yes |
| Go | ~380ms | Yes |

---

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| Docker daemon error | `sudo chmod 666 /var/run/docker.sock` |
| Runner not found | `./build-runners.sh` |
| Redis timeout | `docker-compose restart redis` |
| Port in use | Change `PORT` in `.env` |

---

## 📁 Key Files

```
server.js              # Main API server
src/api/routes.js      # API endpoints
src/docker/runner.js   # Docker execution logic
src/workers/executor.js # Job processor
src/security/limits.js  # Security config
docker-compose.yml     # Service orchestration
```

---

## 🔄 Deployment Checklist

- [ ] Build runner images
- [ ] Configure `.env`
- [ ] Start services
- [ ] Test health endpoint
- [ ] Test execution
- [ ] Check logs
- [ ] Monitor queue stats
- [ ] Set up alerts
- [ ] Configure backups
- [ ] Document for team

---

## 📚 Documentation

- `README.md` - Complete documentation
- `DEPLOYMENT.md` - Deployment guide
- `EXAMPLES.md` - Integration examples
- `test-api.sh` - API test script

---

## 🆘 Support Commands

```bash
# Check service status
docker-compose ps

# Restart specific service
docker-compose restart sandbox-service

# View resource usage
docker stats

# Clean up unused images
docker system prune -a

# Full reset
docker-compose down -v
docker system prune -a -f
./build-runners.sh
docker-compose up -d
```

---

**🎮 DevWars Sandbox Service - Production Ready**
"