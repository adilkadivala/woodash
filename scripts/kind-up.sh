#!/usr/bin/env bash
# Create Kind cluster, install ingress-nginx, load images, helm install.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CLUSTER="${KIND_CLUSTER:-cluster-1}"
NS=platform

command -v kind >/dev/null
command -v kubectl >/dev/null
command -v docker >/dev/null

if ! kind get clusters | grep -qx "$CLUSTER"; then
  kind create cluster --config "$ROOT/clusters.yml"
fi
kubectl cluster-info

echo "Installing ingress-nginx..."
kubectl apply -f https://kind.sigs.k8s.io/examples/ingress/deploy-ingress-nginx.yaml
kubectl -n ingress-nginx rollout status deploy/ingress-nginx-controller --timeout=300s

[ "${SKIP_BUILD:-}" = 1 ] || "$ROOT/scripts/build-images.sh"

# The gateway image ships helm (store provisioner); reuse it if the host has none.
if ! command -v helm >/dev/null; then
  mkdir -p "$HOME/.local/bin"
  cid=$(docker create mcp-gateway:local)
  docker cp "$cid:/usr/local/bin/helm" "$HOME/.local/bin/helm"
  docker rm "$cid" >/dev/null
  export PATH="$HOME/.local/bin:$PATH"
  echo "Installed helm from mcp-gateway image to ~/.local/bin/helm"
fi
for img in mcp-gateway mcp-dashboard mcp-woo mcp-utils mcp-notes; do
  kind load docker-image "${img}:local" --name "$CLUSTER"
done

SECRETS="$ROOT/charts/platform/secrets.local.yaml"
if [ ! -f "$SECRETS" ]; then
  "$ROOT/scripts/gen-secrets.sh" > "$SECRETS"
  echo "Wrote $SECRETS"
fi

# Chat LLM. Default: host Ollama (binds 127.0.0.1:11434), exposed to the Kind
# network through a socat container on :11435. Set LLM_BASE_URL/LLM_MODEL to use
# a hosted OpenAI-compatible provider instead (key goes in the secrets file).
LLM_ARGS=()
if [ -z "${LLM_BASE_URL:-}" ]; then
  if ! docker ps --format '{{.Names}}' | grep -qx ollama-proxy; then
    docker rm -f ollama-proxy >/dev/null 2>&1 || true
    docker run -d --name ollama-proxy --network host --restart unless-stopped \
      alpine/socat TCP-LISTEN:11435,fork,reuseaddr TCP:127.0.0.1:11434 >/dev/null
  fi
  KIND_GW=$(docker network inspect kind -f '{{range .IPAM.Config}}{{if .Gateway}}{{.Gateway}} {{end}}{{end}}' | tr ' ' '\n' | grep -E '^[0-9.]+$' | head -1)
  LLM_ARGS=(--set "llm.baseUrl=http://${KIND_GW}:11435/v1" --set "llm.model=${LLM_MODEL:-gpt-oss:120b-cloud}" --set llm.egressPort=11435)
elif [ -n "${LLM_MODEL:-}" ]; then
  LLM_ARGS=(--set "llm.baseUrl=${LLM_BASE_URL}" --set "llm.model=${LLM_MODEL}")
fi

helm upgrade --install platform "$ROOT/charts/platform" \
  --namespace "$NS" --create-namespace \
  -f "$ROOT/charts/platform/values-local.yaml" \
  -f "$SECRETS" "${LLM_ARGS[@]}"

echo
echo "Store:     http://store.localtest.me  (localtest.me → 127.0.0.1)"
echo "Dashboard: http://app.localtest.me"
echo "MCP:       http://app.localtest.me/mcp"
echo "Wait for:  kubectl -n $NS get jobs,pods"
echo "Extra stores: dashboard → Stores (hosts: http://{slug}.localtest.me)"
echo "WP admin / dashboard passwords: $SECRETS"
