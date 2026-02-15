#!/bin/bash

set -e

echo "🛠️  Building sandbox runner images..."
echo ""

RUNNERS=("python" "node" "cpp" "java" "go")

for runner in "${RUNNERS[@]}"; do
  echo "🐳 Building sandbox-${runner}-runner:latest..."
  docker build -t "sandbox-${runner}-runner:latest" -f "runners/${runner}-runner/Dockerfile" "runners/${runner}-runner/"
  echo "✅ sandbox-${runner}-runner:latest built successfully"
  echo ""
done

echo ""
echo "✨ All runner images built successfully!"
echo ""
echo "Built images:"
docker images | grep "sandbox-.*-runner"
echo ""
echo "🚀 Ready to start services: docker-compose up -d"