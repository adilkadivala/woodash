#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
TAG="${IMAGE_TAG:-local}"

docker build -t "mcp-gateway:${TAG}" -f server/Dockerfile server
docker build -t "mcp-dashboard:${TAG}" -f client/Dockerfile client
docker build -t "mcp-woo:${TAG}" -f woo-mcp/Dockerfile .
docker build -t "mcp-utils:${TAG}" -f utils-mcp/Dockerfile .
docker build -t "mcp-notes:${TAG}" -f notes-mcp/Dockerfile .

echo "Built mcp-{gateway,dashboard,woo,utils,notes}:${TAG}"
