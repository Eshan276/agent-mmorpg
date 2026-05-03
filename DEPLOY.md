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
