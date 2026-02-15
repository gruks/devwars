"# Sandbox Service - Deployment Guide

## 🎯 Overview

This guide covers deploying the sandbox-service microservice in various environments.

---

## 📋 Prerequisites

### Required
- Docker 20.10+
- Docker Compose 2.0+
- 2GB RAM minimum
- 10GB disk space

### Optional
- Kubernetes cluster (for K8s deployment)
- Redis cluster (for production)
- Load balancer (for horizontal scaling)

---

## 🚀 Quick Deploy (Docker Compose)

### 1. Build Runner Images

```bash
cd /app/sandbox-service
./build-runners.sh
```

**Expected output:**
```
✅ sandbox-python-runner:latest built successfully
✅ sandbox-node-runner:latest built successfully
✅ sandbox-cpp-runner:latest built successfully
✅ sandbox-java-runner:latest built successfully
✅ sandbox-go-runner:latest built successfully
```

### 2. Configure Environment

```bash
cp .env.example .env
nano .env  # Edit if needed
```

**Key variables:**
```bash
NODE_ENV=production
PORT=3000
REDIS_HOST=redis
EXECUTION_TIMEOUT=2000
MAX_CONCURRENT_JOBS=10
```

### 3. Start Services

```bash
docker-compose up -d
```

**Services started:**
- `sandbox-api` (port 3000)
- `sandbox-worker` (background)
- `redis` (port 6379)

### 4. Verify Health

```bash
curl http://localhost:3000/health
```

**Expected response:**
```json
{
  \"status\": \"healthy\",
  \"service\": \"sandbox-service\",
  \"timestamp\": 1704067200000,
  \"uptime\": 12.34
}
```

### 5. Test Execution

```bash
curl -X POST http://localhost:3000/api/execute \
  -H \"Content-Type: application/json\" \
  -d '{
    \"language\": \"python\",
    \"code\": \"print(\\"Hello from sandbox!\\")\",
    \"timeout\": 2000
  }'
```

**Expected response:**
```json
{
  \"status\": \"success\",
  \"stdout\": \"Hello from sandbox!\",
  \"stderr\": \"\",
  \"runtime\": \"45ms\",
  \"memory\": \"12mb\"
}
```

---

## 🔧 Production Deployment

### Scale Workers

```bash
docker-compose up -d --scale sandbox-worker=5
```

This runs 5 worker instances for parallel execution.

### Custom Configuration

Edit `docker-compose.yml`:

```yaml
sandbox-worker:
  deploy:
    replicas: 5
    resources:
      limits:
        cpus: '2'
        memory: 1G
```

### Persistent Redis

```yaml
redis:
  volumes:
    - /data/redis:/data
  command: redis-server --appendonly yes --maxmemory 2gb
```

---

## ☸️ Kubernetes Deployment

### 1. Build & Push Images

```bash
# Build service
docker build -t your-registry/sandbox-service:v1.0.0 .

# Build runners
./build-runners.sh

# Tag runners
docker tag sandbox-python-runner:latest your-registry/sandbox-python-runner:v1.0.0
docker tag sandbox-node-runner:latest your-registry/sandbox-node-runner:v1.0.0
docker tag sandbox-cpp-runner:latest your-registry/sandbox-cpp-runner:v1.0.0
docker tag sandbox-java-runner:latest your-registry/sandbox-java-runner:v1.0.0
docker tag sandbox-go-runner:latest your-registry/sandbox-go-runner:v1.0.0

# Push all
docker push your-registry/sandbox-service:v1.0.0
docker push your-registry/sandbox-python-runner:v1.0.0
docker push your-registry/sandbox-node-runner:v1.0.0
docker push your-registry/sandbox-cpp-runner:v1.0.0
docker push your-registry/sandbox-java-runner:v1.0.0
docker push your-registry/sandbox-go-runner:v1.0.0
```

### 2. Create Namespace

```bash
kubectl create namespace sandbox-system
```

### 3. Deploy Redis

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: redis
  namespace: sandbox-system
spec:
  serviceName: redis
  replicas: 1
  selector:
    matchLabels:
      app: redis
  template:
    metadata:
      labels:
        app: redis
    spec:
      containers:
      - name: redis
        image: redis:7-alpine
        ports:
        - containerPort: 6379
        volumeMounts:
        - name: redis-data
          mountPath: /data
  volumeClaimTemplates:
  - metadata:
      name: redis-data
    spec:
      accessModes: [\"ReadWriteOnce\"]
      resources:
        requests:
          storage: 10Gi
---
apiVersion: v1
kind: Service
metadata:
  name: redis
  namespace: sandbox-system
spec:
  clusterIP: None
  selector:
    app: redis
  ports:
  - port: 6379
```

### 4. Deploy Sandbox Service

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: sandbox-api
  namespace: sandbox-system
spec:
  replicas: 3
  selector:
    matchLabels:
      app: sandbox-api
  template:
    metadata:
      labels:
        app: sandbox-api
    spec:
      containers:
      - name: sandbox-api
        image: your-registry/sandbox-service:v1.0.0
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: \"production\"
        - name: REDIS_HOST
          value: \"redis\"
        - name: PORT
          value: \"3000\"
        volumeMounts:
        - name: docker-socket
          mountPath: /var/run/docker.sock
        resources:
          limits:
            cpu: \"1\"
            memory: \"512Mi\"
          requests:
            cpu: \"500m\"
            memory: \"256Mi\"
      volumes:
      - name: docker-socket
        hostPath:
          path: /var/run/docker.sock
---
apiVersion: v1
kind: Service
metadata:
  name: sandbox-api
  namespace: sandbox-system
spec:
  type: LoadBalancer
  selector:
    app: sandbox-api
  ports:
  - port: 80
    targetPort: 3000
```

### 5. Deploy Workers

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: sandbox-worker
  namespace: sandbox-system
spec:
  replicas: 5
  selector:
    matchLabels:
      app: sandbox-worker
  template:
    metadata:
      labels:
        app: sandbox-worker
    spec:
      containers:
      - name: sandbox-worker
        image: your-registry/sandbox-service:v1.0.0
        command: [\"node\", \"src/workers/executor.js\"]
        env:
        - name: NODE_ENV
          value: \"production\"
        - name: REDIS_HOST
          value: \"redis\"
        - name: MAX_CONCURRENT_JOBS
          value: \"10\"
        volumeMounts:
        - name: docker-socket
          mountPath: /var/run/docker.sock
        resources:
          limits:
            cpu: \"2\"
            memory: \"1Gi\"
          requests:
            cpu: \"1\"
            memory: \"512Mi\"
      volumes:
      - name: docker-socket
        hostPath:
          path: /var/run/docker.sock
```

### 6. Apply Manifests

```bash
kubectl apply -f k8s/redis.yaml
kubectl apply -f k8s/sandbox-api.yaml
kubectl apply -f k8s/sandbox-worker.yaml
```

### 7. Verify Deployment

```bash
kubectl get pods -n sandbox-system
kubectl logs -f deployment/sandbox-api -n sandbox-system
```

---

## 🌐 Cloud Deployments

### AWS ECS

1. **Push images to ECR**
2. **Create ECS cluster**
3. **Define task definitions** (API + Worker + Redis)
4. **Create services** with load balancer

### Google Cloud Run

```bash
gcloud run deploy sandbox-service \
  --image gcr.io/your-project/sandbox-service:v1.0.0 \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars REDIS_HOST=redis-ip
```

### Azure Container Instances

```bash
az container create \
  --resource-group sandbox-rg \
  --name sandbox-service \
  --image your-registry/sandbox-service:v1.0.0 \
  --ports 3000 \
  --environment-variables REDIS_HOST=redis-ip
```

---

## 🔐 Security Hardening

### 1. Network Policies

Restrict ingress/egress for worker pods:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: sandbox-worker-policy
  namespace: sandbox-system
spec:
  podSelector:
    matchLabels:
      app: sandbox-worker
  policyTypes:
  - Ingress
  - Egress
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: redis
    ports:
    - protocol: TCP
      port: 6379
```

### 2. Resource Quotas

```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: sandbox-quota
  namespace: sandbox-system
spec:
  hard:
    requests.cpu: \"10\"
    requests.memory: \"20Gi\"
    limits.cpu: \"20\"
    limits.memory: \"40Gi\"
```

### 3. Pod Security Standards

```yaml
apiVersion: policy/v1beta1
kind: PodSecurityPolicy
metadata:
  name: sandbox-psp
spec:
  privileged: false
  allowPrivilegeEscalation: false
  requiredDropCapabilities:
    - ALL
  volumes:
    - 'emptyDir'
    - 'secret'
  runAsUser:
    rule: 'MustRunAsNonRoot'
  seLinux:
    rule: 'RunAsAny'
  fsGroup:
    rule: 'RunAsAny'
```

---

## 📊 Monitoring

### Prometheus Metrics (Future Enhancement)

Add `prom-client` for metrics:

```javascript
import promClient from 'prom-client';

const executionCounter = new promClient.Counter({
  name: 'sandbox_executions_total',
  help: 'Total code executions',
  labelNames: ['language', 'status']
});

const executionDuration = new promClient.Histogram({
  name: 'sandbox_execution_duration_ms',
  help: 'Execution duration in milliseconds',
  labelNames: ['language']
});
```

### Grafana Dashboard

Monitor:
- Execution rate (executions/sec)
- Success/failure ratio
- Timeout rate
- Queue depth
- Worker utilization
- Memory/CPU usage

---

## 🐛 Troubleshooting

### Logs

```bash
# API logs
docker-compose logs -f sandbox-service

# Worker logs
docker-compose logs -f sandbox-worker

# Redis logs
docker-compose logs -f redis
```

### Common Issues

#### 1. \"Cannot connect to Docker daemon\"

**Solution:**
```bash
sudo chmod 666 /var/run/docker.sock
# OR
sudo usermod -aG docker $USER
```

#### 2. \"Runner image not found\"

**Solution:**
```bash
./build-runners.sh
docker images | grep sandbox
```

#### 3. \"Redis connection timeout\"

**Solution:**
```bash
docker-compose restart redis
redis-cli -h localhost -p 6379 ping
```

#### 4. \"Execution timeout on all jobs\"

**Solution:** Increase timeout in `.env`:
```bash
EXECUTION_TIMEOUT=5000
```

---

## 🔄 Updates & Rollback

### Update Service

```bash
docker-compose pull
docker-compose up -d
```

### Rollback

```bash
docker-compose down
git checkout v1.0.0
docker-compose up -d
```

---

## ✅ Post-Deployment Checklist

- [ ] All runner images built
- [ ] Health endpoint responding
- [ ] Execute endpoint working
- [ ] Queue stats accessible
- [ ] Logs flowing correctly
- [ ] Redis persistent storage configured
- [ ] Monitoring/alerting set up
- [ ] Backup strategy defined
- [ ] Security policies applied
- [ ] Documentation shared with team

---

## 🆘 Support

For issues or questions:
1. Check logs: `docker-compose logs`
2. Verify health: `curl http://localhost:3000/health`
3. Test execution: Use example curl commands
4. Review README.md for API documentation

---

**Production-ready sandbox infrastructure for DevWars 🎮**
"