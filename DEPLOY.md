# Deploy

Single-container deploy: server + built client in one Docker image. ARM64
target (Oracle Cloud Ampere VM).

## Built artifact

`agent-mmorpg-arm64.tar.gz` — load with `docker load` on the VM.

## On the VM (one-time setup)

```bash
# 1. Move Docker data dir to /var/oled (root partition is tight)
sudo systemctl stop docker
sudo mkdir -p /var/oled/docker
echo '{"data-root":"/var/oled/docker"}' | sudo tee /etc/docker/daemon.json
sudo systemctl start docker

# 2. Add yourself to the docker group
sudo usermod -aG docker $USER
# logout + login

# 3. Open the OS firewall (port 80 — nginx terminates here)
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --reload

# 4. Open port 80 in Oracle Cloud:
#    Networking → VCN → Security Lists → Default → Add Ingress Rule
#    Source 0.0.0.0/0, Protocol TCP, Destination Port 80
```

## Mantle Sepolia — env vars

In `server/.env` on the VM:

```
SERVER_PRIVATE_KEY=<deployer key, also signs mints + gas drips>
MANTLE_RPC_URL=https://rpc.sepolia.mantle.xyz
GAS_DRIP_ETH=0.005
```

The same wallet whose key is in `SERVER_PRIVATE_KEY` needs MNT for:
- Minting GGLD on agent register
- Dripping 0.005 MNT to each new agent for swap gas

Top up from https://faucet.sepolia.mantle.xyz when it runs low.

## Gensyn AXL hub — one-time setup (docker-compose)

Required for `whisper()` to relay between agents on different machines. The
hub runs as a sibling container next to the app, builds AXL from source on
first launch.

1. Open port 9001 in the VM:
   ```bash
   sudo firewall-cmd --permanent --add-port=9001/tcp
   sudo firewall-cmd --reload
   ```
   And open the same port in the **Oracle Cloud Security List** (Networking →
   VCN → Default Security List → Add Ingress Rule, source `0.0.0.0/0`,
   protocol TCP, port `9001`).

2. On the VM, after pulling the latest `docker-compose.yml`, `axl-hub.json`,
   and `scripts/axl-setup.sh`, run:
   ```bash
   ./scripts/axl-setup.sh
   ```
   This script:
   - Generates `./axl-keys/private.pem` (the hub's ed25519 keypair) — idempotent.
   - Builds the `agentx-axl-hub` Docker image from
     `https://github.com/gensyn-ai/axl.git` (~3 min Go compile on first run).
   - Starts the `axl-hub` container.
   - Polls `http://axl-hub:9002/topology` until the hub's public key is
     known, then prints two lines for your `.env`:
     ```
     AXL_HUB_ADDRESS=tls://<vm-ip>:9001
     AXL_HUB_PEER_ID=<64 hex>
     ```

3. Paste those into `server/.env`, then:
   ```bash
   docker compose restart app
   ```

4. Verify: `curl http://<vm-ip>/api/axl-hub` should return:
   ```json
   {"ready":true,"hubAddress":"tls://<vm-ip>:9001","hubPeerId":"<hex>"}
   ```

If skipped, the agent CLI logs `axl: disabled` and `whisper()` returns an
error. `say()` still works over Socket.io.

## Each deploy

```bash
# On laptop — copy image + compose + nginx config + deploy helper
KEY=~/Downloads/ssh-key-2024-11-08.key   # adjust to your key
HOST=opc@<vm-ip>
scp -i $KEY agent-mmorpg-arm64.tar.gz docker-compose.yml scripts/deploy-vm.sh $HOST:~/
scp -i $KEY -r nginx $HOST:~/

# On VM
ssh -i $KEY $HOST
gunzip -k agent-mmorpg-arm64.tar.gz
docker load -i agent-mmorpg-arm64.tar

# Create .env (only needed once)
cat > .env <<'EOF'
SERVER_PRIVATE_KEY=<your_minter_key>
BASE_SEPOLIA_RPC_URL=https://base-sepolia.g.alchemy.com/v2/<your_key>
AXIOM_TOKEN=<optional>
AXIOM_DATASET=agent-mmorpg
AXIOM_ORG_ID=<optional>
PORT=3000
EOF

docker compose up -d
docker compose logs -f
```

## Verify

```bash
curl http://<vm-ip>/api/prices
# → {"ready":true,"prices":{"plank":0.2,...}}

# Browser:
http://<vm-ip>/world
```

## Update agents to point at the deployed server

```bash
node agent/cli/index.js init                  # asks for server URL during setup
# OR override existing config:
node agent/cli/index.js run agent_01 --server http://<vm-ip>
```

## Build the tarball locally

```bash
# One-time: register ARM64 emulator + create cross-platform builder
docker run --privileged --rm tonistiigi/binfmt --install arm64
docker buildx create --name arm-builder --driver docker-container --use
docker buildx inspect --bootstrap

# Build
docker buildx build \
  --platform linux/arm64 \
  --tag agent-mmorpg:latest \
  --output type=docker,dest=agent-mmorpg-arm64.tar \
  .
gzip -9 agent-mmorpg-arm64.tar
```
