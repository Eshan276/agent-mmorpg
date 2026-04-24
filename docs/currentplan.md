# Plan: LLM Agent System (Node.js Sidecar via Socket.io)

## Context
The game is a complete Phaser 3 MMORPG client. No human plays it — an LLM agent drives the player. Users configure the agent CLI with an Anthropic API key or local Ollama endpoint. The architecture must be multiplayer-ready from day one: multiple agents can connect simultaneously, each paired to a browser tab. A Node.js server acts as relay between browser clients and agent CLIs.

## Architecture Overview

```
Browser (Phaser)  ←→  Socket.io Server  ←→  Agent CLI (Node.js)
  AgentBridge.js         GameServer.js         AgentLoop.js
  (state export)         (relay + rate limit)  (LLM → action)
```

**Data flow:**
1. Browser's `AgentBridge` builds an `ObservationSnapshot` every 500ms → emits `browser:stateUpdate`
2. Server receives snapshot, mirrors it, forwards to paired agent as `server:observation`
3. Agent's LLM call returns one action string → emits `agent:action`
4. Server rate-limits (200ms min between actions), forwards to paired browser as `server:actionForBrowser`
5. Browser receives action → calls `window.performAction(action)`

## Files to Create / Modify

### New files
- `agent/package.json` — npm workspace, deps: socket.io-client, @anthropic-ai/sdk, commander
- `agent/index.js` — CLI entry (commander: --server, --provider, --model, --api-key, --ollama-url, --tick-ms)
- `agent/AgentLoop.js` — socket.io connection, observation polling, LLM dispatch, action emission
- `agent/prompt.js` — system prompt builder + user prompt builder (observation → string) + parseAction()
- `agent/providers/AnthropicProvider.js` — Anthropic SDK wrapper, system prompt cached per session
- `agent/providers/OllamaProvider.js` — fetch to /api/chat, stream:false, num_predict:100

### Modified files
- `server/src/GameServer.js` — full rewrite: add agent socket namespace, pairing logic, rate limiting, state mirror
- `client/src/systems/AgentBridge.js` (NEW in client) — builds ObservationSnapshot, connects to server, dispatches received actions
- `client/src/systems/ActionSystem.js` — add `getMapObjects()` export
- `client/src/main.js` — import and init AgentBridge after ActionSystem
- `client/src/scenes/GameScene.js` — pass mapObjects ref to AgentBridge on scene create
- `package.json` (root) — add `agent` to workspaces array
- `client/package.json` — add socket.io-client dependency
- `client/vite.config.js` — add `/socket.io` proxy to server

## ObservationSnapshot Schema
```json
{
  "tick": 1234,
  "player": { "tileX": 10, "tileY": 12, "direction": "down", "hp": 80, "maxHp": 100, "energy": 60, "maxEnergy": 100, "zone": "Shinobi Village" },
  "inventory": [{ "id": "axe", "name": "Axe", "qty": 1 }, ...],
  "gold": 5,
  "facing": { "type": "npc", "id": "merchant" } | { "type": "harvest", "resourceType": "tree" } | null,
  "nearbyNodes": [{ "resourceType": "tree", "tileX": 11, "tileY": 12, "depleted": false }, ...],
  "nearbyItems": [{ "id": "plank", "tileX": 10, "tileY": 13 }, ...],
  "blockedDirections": ["up", "left"],
  "recentEvents": ["Harvested tree: got 2x plank", "HP low"]
}
```

## Socket.io Event Protocol
| Event | Direction | Payload |
|---|---|---|
| `browser:register` | browser→server | `{ tabId }` |
| `browser:stateUpdate` | browser→server | `ObservationSnapshot` |
| `agent:register` | agent→server | `{ agentId, tabId? }` |
| `agent:action` | agent→server | `{ action: string }` |
| `server:observation` | server→agent | `ObservationSnapshot` |
| `server:actionForBrowser` | server→browser | `{ action: string }` |
| `server:agentJoined` | server→browser | `{ agentId }` |
| `server:agentLeft` | server→browser | `{ agentId }` |
| `server:playerList` | server→agent | `[{ tabId, zone, hp }]` |

**V1 routing**: server broadcasts all agent actions to all browser tabs (single-player safe).  
**V2 (future)**: `tabId` in `agent:register` enables 1:1 pairing.

## Agent CLI Usage
```bash
# Anthropic
node agent/index.js --provider anthropic --api-key sk-ant-... --tick-ms 800

# Ollama (local)
node agent/index.js --provider ollama --model llama3 --tick-ms 1200

# Connect to remote server
node agent/index.js --server ws://game.example.com:3000 --provider anthropic --api-key ...
```

## LLM Prompt Design

**System prompt** (sent once, cached):
```
You are an agent playing a 2D MMORPG. Each turn you receive a JSON observation and must reply with exactly one action word.

Valid actions: move_up, move_down, move_left, move_right, interact, wait
- interact: use when facing a chest, NPC, harvest node, or item
- wait: use when processing or waiting for something

Reply with ONLY the action word. No explanation.
```

**User prompt** (rebuilt each tick): compact JSON of ObservationSnapshot.

**parseAction()**: strips markdown/quotes/whitespace, validates against action set, falls back to `wait`.

## Key Implementation Details

### AgentBridge.js (client)
```js
export const AgentBridge = {
  init(scene, player, actionSystem),
  _buildSnapshot() → ObservationSnapshot,
  _onAction(action) → window.performAction(action),
}
```
- Polls every 500ms via `setInterval`
- Uses `ActionSystem.getFacingObject()`, `ActionSystem.getMapObjects()`
- Reads `StateManager.getState()` for player pos/stats/zone
- Reads `player.inventory.slots` for inventory
- `recentEvents`: ring buffer of last 5 game events (harvests, pickups, damage)

### GameServer.js (server)
```js
// Rate limiting per browser tab
const lastActionTime = new Map(); // tabId → timestamp
const MIN_ACTION_GAP = 200; // ms

io.on('connection', socket => {
  // browser:register → track tabId
  // browser:stateUpdate → mirror state, forward to agents
  // agent:register → track agentId + optional tabId pairing  
  // agent:action → rate-limit check, forward to browsers as server:actionForBrowser
})
```

### AnthropicProvider.js
```js
class AnthropicProvider {
  constructor({ apiKey, model = 'claude-sonnet-4-6' })
  async complete(systemPrompt, userPrompt) // returns action string
}
```
- Uses `@anthropic-ai/sdk` Messages API
- `max_tokens: 256`
- System prompt passed as top-level `system` param (enables prompt caching)

### OllamaProvider.js
```js
class OllamaProvider {
  constructor({ baseUrl = 'http://localhost:11434', model = 'llama3' })
  async complete(systemPrompt, userPrompt) // returns action string
}
```
- POST to `{baseUrl}/api/chat` with `stream: false`, `num_predict: 100`
- Messages array: `[{role:'system', content: systemPrompt}, {role:'user', content: userPrompt}]`

## Migration Path
- **V1 (now)**: Single agent, broadcast routing — works for single-player use
- **V2**: Add `tabId` pairing via handshake token — enables true multiplayer (each agent controls one tab)
- **V3**: Server-authoritative state (server validates moves) — full MMO backend

## Critical Files
- `client/src/systems/AgentBridge.js` — NEW, bridges Phaser state to socket
- `client/src/systems/ActionSystem.js` — add `getMapObjects()` export
- `server/src/GameServer.js` — rewrite with agent routing
- `agent/AgentLoop.js` — LLM polling loop
- `agent/providers/AnthropicProvider.js` + `OllamaProvider.js`
- `client/vite.config.js` — add `/socket.io` proxy

## Verification
1. `npm run dev` in root — starts Vite (port 5173) + server (port 3000)
2. Open browser at `http://localhost:5173` — game loads, AgentBridge connects to server
3. Run `node agent/index.js --provider ollama --model llama3` — agent registers
4. Browser console: observe `server:agentJoined` event logged
5. Agent starts receiving `server:observation` every 500ms
6. Agent emits actions — player moves in browser without keyboard input
7. Test rate limiting: rapid agent actions should be throttled to 200ms
8. Test `wait` action: player stays still, no errors
9. Kill agent process: browser receives `server:agentLeft`
10. Multi-tab test: open two browser tabs, run two agent CLIs — each tab controlled independently (V1: both move, V2: each paired)

## Files to Create
- `/home/eshan/workdump/agent-mmorpg/index.html`
- `/home/eshan/workdump/agent-mmorpg/main.js`
- `/home/eshan/workdump/agent-mmorpg/tilemap.json`

## Tilemap Design (20×20)
Tile IDs: `0`=grass (green), `1`=path (tan), `2`=water (blue, non-walkable), `3`=wall (grey, non-walkable)

Layout:
- Water border around entire outer edge
- Cross-shaped path: horizontal at row 10 (cols 1–17), vertical at col 10 (rows 1–17)
- Wall structure (hollow 3×3 box) at cols 13–15, rows 2–5
- Small lake (3×3 water) at cols 14–16, rows 13–15
- Two chest objects (type from `objects` array): `{tileX:10, tileY:8}` and `{tileX:12, tileY:12}`
- Player spawns at tile (5, 5) — clear grass area

Chests are in `mapData.objects` (not the ground layer), rendered as brown squares with gold lids on top of ground tiles.

## Architecture: Four Logical Modules in main.js

### 1. StateManager (IIFE)
Owns the canonical game state object:
```js
state = {
  player: { tileX, tileY, direction, isMoving },
  map:    { width, height, data }
}
```
Methods: `getState()`, `setPlayerPos(tx, ty)`, `setPlayerDir(dir)`, `setPlayerMoving(bool)`, `initMap(w, h, data)`

Exposed globally: `window.getGameState = () => StateManager.getState()`

### 2. ActionSystem (IIFE)
Central entry point for ALL player actions. Holds a `sceneRef` (set during `create()`) and `mapObjects` list.

`performAction(actionType)` switch:
- `move_up/down/left/right` → `tryMove(dx, dy, dir)`
  1. Set player direction (facing updates even when blocked)
  2. Check `isWalkable(nx, ny)` — ground layer `WALKABLE = Set([0,1])` AND no chest object at target
  3. If walkable: `setPlayerMoving(true)`, `setPlayerPos(nx, ny)` (state updates immediately), call `sceneRef.tweenPlayerTo(nx, ny, callback)` which sets `isMoving=false` on complete
  4. If blocked: return (player already faces direction)
- `interact` → `tryInteract()`
  1. Compute facing tile from `direction` offset map
  2. `getChestAt(tx, ty)` checks `mapObjects`
  3. If chest found: `sceneRef.showInteractPopup("You found something!")`

`isMoving` lock: if `player.isMoving === true`, `performAction` returns immediately (guards against input spam during 150ms tween).

Exposed globally: `window.performAction = ActionSystem.performAction`

### 3. InputHandler (IIFE)
Pure translator: keypresses → `ActionSystem.performAction()` calls. Zero movement logic here.

- `init(scene)`: creates `cursors` (arrow keys) + `wasd` key map + `SPACE`/`E` for interact
- `update(time)`: checks held directional keys with 150ms repeat delay → calls `performAction`
- Interact: `keydown` event only (no repeat)

### 4. GameScene (Phaser.Scene)
Rendering and Phaser lifecycle.

**`preload()`**: `this.load.json('tilemap', 'tilemap.json')`

**`create()`**:
1. `StateManager.initMap(...)`, `ActionSystem.init(this, mapData.objects)`
2. `renderTilemap()` — one `fillRect(px, py, tileSize-1, tileSize-1)` per tile using color map; `-1` gap creates grid lines without extra stroke calls
3. `renderObjects()` — chests drawn as brown rect + gold lid strip + dark lock dot
4. `createPlayerSprite()` — `Container` + `Graphics`. Body: blue rect. Direction nub: white square on the facing edge. Container is what tweens move and camera follows.
5. Popup text: `this.add.text(...)` with dark background, depth 100, hidden by default
6. Camera: `setBounds(0,0,mapW,mapH)` + `startFollow(container, true, 0.1, 0.1)` (lerp for smooth follow)
7. `InputHandler.init(this)`

**`update(time)`**: calls `InputHandler.update(time)`

**`tweenPlayerTo(tx, ty, cb)`**: 150ms Linear tween on container x/y to tile center pixel. `onComplete` → `cb()` → `setPlayerMoving(false)`.

**`showInteractPopup(msg)`**: positions text above player tile, sets visible, schedules `delayedCall(2000, hide)`. Clears previous timer on re-trigger.

## Tilemap JSON
```json
{
  "width": 20, "height": 20, "tileSize": 32,
  "layers": [{ "name": "ground", "data": [400 ints] }],
  "objects": [
    { "type": "chest", "tileX": 10, "tileY": 8 },
    { "type": "chest", "tileX": 12, "tileY": 12 }
  ]
}
```

## index.html
Minimal shell: loads Phaser 3.60.0 from jsDelivr CDN, then `main.js`. Canvas centered, black body background. No async/defer (order matters).

## Phaser Game Config
```js
{ type: Phaser.AUTO, width: 640, height: 640,
  backgroundColor: '#000',
  scene: [GameScene],
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH } }
```
640px = 20 tiles × 32px — entire map fits without scrolling initially.

## Key Gotchas
- **Chests block walking**: `isWalkable` must check `mapObjects` in addition to ground layer, otherwise player can walk through chests
- **Tween duration matches key-repeat**: both set to 150ms so held keys move exactly 1 tile/150ms with no dropped inputs
- **Tile state updates ahead of visual**: `setPlayerPos` fires before tween starts — `getGameState()` always returns destination tile, not mid-tween position
- **file:// CORS**: `load.json` fails in Chrome when opened as `file://`. Fix by embedding tilemap inline as a JS constant, avoiding the `preload` fetch entirely (more robust, no server needed)
- **Depth ordering**: ground (0) → chests (1) → player (10) → popup (100)

## Multiplayer Extensibility (Future)
- Bot: `window.performAction('move_right')` works today, no changes needed
- Network receive: WebSocket `onmessage` → `window.performAction(msg.action)`
- Network send: wrap `performAction` to emit before executing (optimistic) or after ack (authoritative)
- State sync: poll `window.getGameState()` at any interval
- Remote players: add `RemotePlayerManager` with its own Container pool; bypasses ActionSystem entirely

## Verification
1. Run `python3 -m http.server 8080` in project dir, open `http://localhost:8080`
2. Player renders as blue square at tile (5,5) with white direction nub
3. Arrow keys / WASD move player one tile at a time with smooth tween
4. Water border and wall structure block movement
5. Face a chest (tile adjacent) and press Space/E → popup "You found something!" for 2 seconds
6. Open browser console: `window.getGameState()` returns current state object
7. Open browser console: `window.performAction('move_right')` moves player one tile right
