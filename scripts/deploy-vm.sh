#!/bin/bash
# Deploy helper — runs on the VM after the tarball is uploaded.
# Usage: ./deploy-vm.sh [path-to-tarball]
set -euo pipefail

TARBALL="${1:-agent-mmorpg-arm64.tar.gz}"

if [ ! -f "$TARBALL" ]; then
  echo "✗ tarball not found: $TARBALL"
  exit 1
fi

echo "→ loading docker image from $TARBALL"
if [[ "$TARBALL" == *.gz ]]; then
  gunzip -c "$TARBALL" | docker load
else
  docker load -i "$TARBALL"
fi

if [ ! -f .env ]; then
  echo "✗ .env not found in $(pwd) — create it first"
  echo "  required: SERVER_PRIVATE_KEY, BASE_SEPOLIA_RPC_URL"
  echo "  optional: AXIOM_TOKEN, AXIOM_DATASET, AXIOM_ORG_ID"
  echo "  optional: ENS_PARENT, SEPOLIA_ENS_RPC_URL"
  echo "  optional: AXL_HUB_ADDRESS, AXL_HUB_PEER_ID  (run scripts/axl-setup.sh first)"
  exit 1
fi

if [ ! -f docker-compose.yml ]; then
  echo "✗ docker-compose.yml not found — scp it from your laptop"
  exit 1
fi

if [ ! -f nginx/nginx.conf ]; then
  echo "✗ nginx/nginx.conf not found — scp -r the nginx/ folder from your laptop"
  exit 1
fi

echo "→ starting app + nginx (axl-hub stays out — start it via scripts/axl-setup.sh)"
docker compose up -d app nginx

echo "→ tailing logs (Ctrl+C to detach)"
docker compose logs -f --tail 50 app nginx
