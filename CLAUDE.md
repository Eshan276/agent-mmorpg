# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Root — start client + server together
npm run dev

# Server only (port 3000, requires server/.env)
npm run dev -w server

# Client only (port 5173, proxies /socket.io and /api to :3000)
npm run dev -w client

# Production build (client only)
npm run build

# Run an agent
node agent/index.js --provider gemini --api-key KEY --agent-id agent_01
node agent/index.js --provider anthropic --api-key KEY --agent-id agent_01
node agent/index.js --provider ollama --model qwen2.5:7b --agent-id agent_01
```

Agent CLI flags: `--server`, `--provider`, `--model`, `--api-key`, `--ollama-url`, `--agent-id`.

## Architecture

Three workspaces: **server**, **client**, **agent**. No shared packages between them.

### Communication flow

```
Agent ──socket.io──► GameServer ──► WorldSimulation (authoritative state)
                         │
Spectator ◄──200ms broadcast──┘
```

- Agents register with `agent:register {agentId}`, receive `server:observation` after each `agent:action`
- Spectators get full world state every 200ms via `server:worldState`
- Server enforces 150ms rate limit per action; agent waits 200ms before emitting

### Server (`server/src/`)

- `GameServer.js` — Socket.io server. Owns `_agents`, `_spectators`, `_chatMsgs` (6s TTL). Injects `agentChat` into every observation so agents can hear each other's chat. Only logs "meaningful" actions to Axiom (interact, eat, buy, events — not raw movement).
- `WorldSimulation.js` — Authoritative game state. Handles movement, harvesting, merchant, buy/eat, respawn. Harvest nodes block movement (`_isWalkable` checks nodes). Observations include `facing`, `nearbyNodes`, `blockedDirections`, `recentEvents` (cleared after each build).
- `ServerPlayer.js` — Player entity. Spawns with axe + pickaxe. `ITEM_DEFS`, `SHOP_SELL_PRICES`, `SHOP_BUY_PRICES` all live here.
- `AxiomLogger.js` — Logs to Axiom if `AXIOM_TOKEN` env is set; silently disabled if not.

### Client (`client/src/`)

Spectator-only Phaser 3 view. `world.js` is the entry for the world view (`/world.html`). `main.js` is a separate game entry. Camera uses `Scale.RESIZE` mode with a computed `_minZoom` floor so the map always fills the viewport — never zoom out past `max(viewW/mapW, viewH/mapH)`. Pan uses `ptr.x - ptr.prevPosition.x` delta; zoom is cursor-anchored.

### Agent (`agent/`)

`AgentLoop.js` runs a session loop:
1. Wait for observation snapshot
2. Call `provider.completeWithTools(systemPrompt, messages, tools)` (multi-turn, accumulates messages)
3. Execute each tool call; append `tool_result` to messages
4. Repeat until `done()` or 60-tool limit
5. Wait 500ms, start new session

`_walkTo` does per-step navigation with stuck detection (≤3 unique tiles in last 10 steps → `{stuck: true}`). When 1 tile away and blocked, peeks to check if facing a `harvest`/`chest` — if so returns arrived; if NPC/player, routes around.

`tools.js` holds both `TOOLS` (7 tool definitions) and `SYSTEM_PROMPT`. The prompt has a mandatory **Talking — REQUIRED** section; agents must `say()` at least once per session.

`prompt.js` builds the session-opening observation as compact text (not JSON), with situation alerts for low HP/energy, facing interactables, nearby nodes, and other agents' chat.

### LLM Providers (`agent/providers/`)

All implement `completeWithTools(systemPrompt, messages, tools) → {content}` in Anthropic format. Internal format conversion handles Ollama, Gemini, and OpenAI-compatible APIs.

| Provider | Default model | Notes |
|---|---|---|
| `AnthropicProvider` | `claude-haiku-4-5-20251001` | Direct SDK |
| `OllamaProvider` | `qwen2.5:7b` | Native tool-calling API |
| `GeminiProvider` | `gemini-2.5-flash` | Direct Google API, fastest |
| `OpenRouterProvider` | `google/gemini-2.5-flash:google` | OpenAI-compat, needs provider routing |
| `ClaudeCodeProvider` | — | Rule-based, no API, for testing |

Tool results include `_toolName` field (needed by Gemini's `functionResponse.name`). Tool result `ok` field reflects actual success — parsed from `recentEvents` strings like "Not enough energy", "Not facing merchant", "Nothing to eat".

## Key game facts

- Agents spawn at (40, 35) with axe + pickaxe already in inventory
- Merchant at (34, 33) — stand at (34, 34) facing up to sell/buy
- Node at (X, Y) → approach at (X, Y+1) facing up
- HP drains 3/30s hunger + 2/20s in hostile zones; energy only regens in Shinobi Village
- Interacting with merchant/chest costs 10 energy; harvesting costs 0
- `recentEvents` is a ring buffer (max 8), cleared after each `buildObservation`
