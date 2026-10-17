#!/usr/bin/env bash
# Create Kind cluster, install ingress-nginx, load images, helm install.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CLUSTER="${KIND_CLUSTER:-cluster-1}"
NS=platform

command -v kind >/dev/null
command -v helm >/dev/null
command -v kubectl >/dev/null

if ! kind get clusters | grep -qx "$CLUSTER"; then
  kind create cluster --config "$ROOT/clusters.yml"
fi
kubectl cluster-info

echo "Installing ingress-nginx..."
kubectl apply -f https://kind.sigs.k8s.io/examples/ingress/deploy-ingress-nginx.yaml
kubectl -n ingress-nginx wait --for=condition=ready pod -l app.kubernetes.io/component=controller --timeout=180s

"$ROOT/scripts/build-images.sh"
for img in mcp-gateway mcp-dashboard mcp-woo mcp-utils mcp-notes; do
  kind load docker-image "${img}:local" --name "$CLUSTER"
done

SECRETS="$ROOT/charts/platform/secrets.local.yaml"
if [ ! -f "$SECRETS" ]; then
  "$ROOT/scripts/gen-secrets.sh" > "$SECRETS"
  echo "Wrote $SECRETS"
fi

helm upgrade --install platform "$ROOT/charts/platform" \
  --namespace "$NS" --create-namespace \
  -f "$ROOT/charts/platform/values-local.yaml" \
  -f "$SECRETS"

echo
echo "Store:     http://store.localtest.me  (localtest.me → 127.0.0.1)"
echo "Dashboard: http://app.localtest.me"
echo "MCP:       http://app.localtest.me/mcp"
echo "Wait for:  kubectl -n $NS get jobs,pods"
echo "Extra stores: dashboard → Stores (hosts: http://{slug}.localtest.me)"
echo "WP admin / dashboard passwords: $SECRETS"
