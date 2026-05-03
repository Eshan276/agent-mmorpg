# syntax=docker/dockerfile:1.6

# ──────────────────────────────────────────────────────────────────────────────
# Stage 1 — build the client bundle
# ──────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS client-build
WORKDIR /repo

# Copy only what's needed to install workspace deps for the client
COPY package.json package-lock.json ./
COPY client/package.json ./client/
# We have to declare all workspaces because npm validates the workspace tree
COPY server/package.json ./server/
COPY agent/package.json  ./agent/

# Install everything (including devDependencies — vite is a devDep)
# npm has a known bug with rollup's optional native deps that omits the
# correct binary for the build platform when the lockfile was generated
# elsewhere. Explicitly install the alpine-arm64 binary so rollup loads.
# See: https://github.com/npm/cli/issues/4828
RUN npm ci --workspaces --include-workspace-root \
 && npm install --no-save --workspace=client \
      @rollup/rollup-linux-arm64-musl

# Copy the client source and build it
COPY client ./client
RUN npm run build -w client

# ──────────────────────────────────────────────────────────────────────────────
# Stage 2 — server-only runtime
# ──────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

# Install only the server's production deps
COPY package.json package-lock.json ./
COPY server/package.json ./server/
COPY client/package.json ./client/
COPY agent/package.json  ./agent/
RUN npm ci --omit=dev -w server

# Server source + Web3 contract addresses
COPY server   ./server
COPY contracts/deployed.json ./contracts/deployed.json

# WorldSimulation reads ../../client/public/tilemap.json relative to server/src/
# Ship the source tilemap so that relative path still resolves at runtime.
COPY client/public/tilemap.json ./client/public/tilemap.json

# Built client → served as static files
COPY --from=client-build /repo/client/dist ./server/public

EXPOSE 3000
CMD ["node", "server/src/index.js"]
