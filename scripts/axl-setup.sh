#!/bin/bash
# Run once on the VM after pulling the new docker-compose.yml + axl-hub.json.
# - Generates the hub ed25519 keypair (idempotent — won't overwrite)
# - Builds + starts the axl-hub container
# - Prints the hub peer id and the .env lines you need to add
set -euo pipefail

cd "$(dirname "$0")/.."

# 1. Clone AXL source (compose builds from a local context — avoids DNS issues
#    with buildkit's git-context fetcher on Oracle Cloud).
if [ ! -d ./axl-source/.git ]; then
  echo "→ cloning gensyn-ai/axl…"
  git clone --depth 1 https://github.com/gensyn-ai/axl.git ./axl-source
else
  echo "✓ axl-source already cloned (use 'cd axl-source && git pull' to update)"
fi

# 2. Keypair
mkdir -p ./axl-keys
if [ ! -f ./axl-keys/private.pem ]; then
  echo "→ generating ed25519 keypair…"
  openssl genpkey -algorithm ed25519 -out ./axl-keys/private.pem
  chmod 600 ./axl-keys/private.pem
  echo "✓ wrote ./axl-keys/private.pem"
else
  echo "✓ keypair already exists at ./axl-keys/private.pem"
fi

# 3. Build + start the hub container
echo "→ building axl-hub (first run may take ~3 min for the Go compile)…"
docker compose build axl-hub
echo "→ starting axl-hub…"
docker compose up -d axl-hub

# 3. Wait for the hub to publish its public key
echo "→ waiting for hub to be ready…"
HUB_ID=""
for i in {1..30}; do
  sleep 2
  HUB_ID=$(docker compose exec -T axl-hub sh -c \
    "wget -qO- http://127.0.0.1:9002/topology 2>/dev/null | sed -n 's/.*\"our_public_key\":\"\\([^\"]*\\)\".*/\\1/p'" \
    2>/dev/null || true)
  if [ -n "$HUB_ID" ]; then break; fi
done

if [ -z "$HUB_ID" ]; then
  echo "✗ hub did not become ready in 60s — check 'docker compose logs axl-hub'"
  exit 1
fi

echo ""
echo "✓ hub ready"
echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo "Add these lines to your .env file, then 'docker compose restart app':"
echo "═══════════════════════════════════════════════════════════════════"
echo "AXL_HUB_ADDRESS=tls://$(curl -s ifconfig.me 2>/dev/null || echo '<your-vm-public-ip>'):9001"
echo "AXL_HUB_PEER_ID=$HUB_ID"
echo "═══════════════════════════════════════════════════════════════════"
echo ""
echo "Then test: curl http://<vm-ip>/api/axl-hub"
