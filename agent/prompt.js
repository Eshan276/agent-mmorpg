// ── Tool definitions (used by AnthropicProvider) ─────────────────────────────

export const TOOLS = [
  {
    name: 'move',
    description: 'Move one tile in a direction. Use this for single-step movement.',
    input_schema: {
      type: 'object',
      properties: {
        direction: {
          type: 'string',
          enum: ['up', 'down', 'left', 'right'],
          description: 'Which direction to move',
        },
        reason: {
          type: 'string',
          description: 'Why you are moving this direction and what your current goal is',
        },
      },
      required: ['direction', 'reason'],
    },
  },
  {
    name: 'go_to',
    description: 'Navigate toward a tile coordinate. The agent will pathfind step by step. Use this to reach a harvest node, chest, NPC, or world item.',
    input_schema: {
      type: 'object',
      properties: {
        tileX: { type: 'number', description: 'Target tile X coordinate' },
        tileY: { type: 'number', description: 'Target tile Y coordinate' },
        reason: { type: 'string', description: 'What you are going to do there (e.g. "harvest tree", "open chest", "sell to merchant")' },
      },
      required: ['tileX', 'tileY', 'reason'],
    },
  },
  {
    name: 'interact',
    description: 'Interact with whatever you are currently facing — harvest a node, open a chest, talk to an NPC (sells all resources), or pick up an item.',
    input_schema: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'What you are interacting with and why',
        },
      },
      required: ['reason'],
    },
  },
  {
    name: 'wait',
    description: 'Do nothing this tick. Use when regenerating HP/energy or waiting for a node to respawn.',
    input_schema: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Why you are waiting',
        },
      },
      required: ['reason'],
    },
  },
];

// ── Static world knowledge (baked in once at startup) ────────────────────────

export const MAP_KNOWLEDGE = `
## World Map (80×80 tiles)

### Zones
- Shinobi Village  — tiles (25,18)→(55,53)  SAFE: HP and energy regenerate here
- Forest of Whispers — tiles (0,0)→(33,56)   HOSTILE: drains HP/energy over time
- Crystal Lake       — tiles (50,0)→(79,35)   HOSTILE: drains HP/energy
- Sunken Sands Desert — tiles (52,45)→(79,79) HOSTILE: drains HP/energy
- Mountain Pass      — tiles (0,58)→(20,79)   HOSTILE: drains HP/energy

### Spawn
- You spawn at (40, 35) — center of Shinobi Village

### NPCs
- Merchant (34, 33) — interact to SELL ALL resources for gold
- Guard    (43, 33) — dialog only
- Elder    (40, 26) — dialog only
- Hunter   (15, 35) — dialog only
- Hermit   (61, 60) — dialog only

### Chests (contain tools and loot)
- Chest (38, 33) — contains axe, pickaxe  ← PRIORITY: get tools first
- Chest (31, 32) — contains life_potion, gold_coin
- Chest (48, 43) — contains katana, gold_coin
- Chest (5, 10)  — contains gem_green, meat

### Harvest Nodes
Bushes (no tool needed, 1 hit, drops grass):
  (38,36) (42,36) (30,30) (44,30) (35,45) (48,42)

Trees (need axe, 3 hits, drops plank/branch):
  (8,10) (14,8) (6,18) (20,14) (4,28) (22,35) (10,44) (16,50)

Rock nodes (need pickaxe, 4 hits, drops rock/bar_iron/gem):
  (29,24) (50,26) (27,48) (52,50) (4,62) (8,65) (14,70) (17,67) (60,50) (68,56)

### Economy
- Sell resources to the Merchant at (34, 33) by interacting
- Sell prices: plank=2g, branch=1g, rock=1g, bar_iron=6g, gem_red=12g, gem_green=10g, bar_gold=18g
`;

// ── System prompt ────────────────────────────────────────────────────────────

export const SYSTEM_PROMPT = `\
You are an autonomous agent playing a 2D top-down pixel MMORPG. You make decisions using tools.
Each turn you receive a JSON observation and must call exactly one tool.

${MAP_KNOWLEDGE}

### Observation fields
- player: your tileX, tileY, direction, hp, maxHp, energy, maxEnergy, zone, alive
- inventory: items you carry [{id, name, qty}]
- gold: your gold total
- facing: what is directly in front of you (type, resourceType, requiredTool) or null
- nearbyNodes: harvest nodes within 5 tiles [{resourceType, tileX, tileY, depleted}]
- nearbyItems: world items on the ground nearby [{id, tileX, tileY}]
- blockedDirections: directions you cannot move right now
- recentEvents: what just happened last tick
- otherAgents: other agents in the world [{agentId, tileX, tileY, hp, zone}]

### Strategy
1. First priority: go to chest (38,33) and interact to get axe + pickaxe if you don't have them
2. Harvest bushes for quick grass (no tool needed)
3. Harvest trees for planks (need axe), rocks for iron/gems (need pickaxe)
4. When inventory has resources, go to Merchant (34,33) and interact to sell for gold
5. Stay in Shinobi Village (safe zone) when HP < 40 to regen
6. Don't walk into blockedDirections — navigate around obstacles
7. If you see another agent nearby, coordinate — don't harvest the same depleted node

Call one tool per turn. Think about the best next action given your current state.`;

// ── Ollama fallback (word-based) ─────────────────────────────────────────────

const VALID_ACTIONS = new Set([
  'move_up', 'move_down', 'move_left', 'move_right', 'interact', 'wait',
]);

export const OLLAMA_SYSTEM_PROMPT = `\
You are an autonomous agent in a 2D pixel MMORPG. Each turn reply with ONE action word only.

${MAP_KNOWLEDGE}

Valid actions: move_up  move_down  move_left  move_right  interact  wait

Current observation fields:
- player: your tileX, tileY, hp, energy, zone
- inventory: items you carry
- facing: object directly in front (or null)
- nearbyNodes: harvest nodes within 5 tiles
- nearbyItems: items on ground nearby
- blockedDirections: directions blocked
- recentEvents: what just happened
- otherAgents: other agents [{agentId, tileX, tileY, hp}]

Strategy:
- Go to chest at (38,33) first to get axe and pickaxe
- Harvest bushes (no tool), trees (need axe), rocks (need pickaxe)
- Sell resources at Merchant (34,33)
- Stay near spawn (40,35) when HP is low (safe zone regens HP)
- Use interact when facing a node/chest/NPC

Reply with ONLY the action word. No explanation.`;

export function buildUserPrompt(snapshot) {
  return JSON.stringify(snapshot, null, 2);
}

export function parseAction(raw) {
  const cleaned = raw.trim().toLowerCase().replace(/[`'"*\n]/g, '').split(/\s+/)[0];
  return VALID_ACTIONS.has(cleaned) ? cleaned : 'wait';
}
