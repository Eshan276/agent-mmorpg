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
        faceDir: { type: 'string', enum: ['up','down','left','right'], description: 'Direction to face on arrival (use "down" for harvest nodes, "up" for merchant/chests from south)' },
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
    name: 'eat',
    description: 'Consume a food item or potion from your inventory to restore HP or energy. Use whenever HP < 60.',
    input_schema: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are eating' },
      },
      required: ['reason'],
    },
  },
  {
    name: 'buy',
    description: 'Buy an item from the merchant. You must be standing at (34,34) facing the merchant. Use to buy food when HP is low.',
    input_schema: {
      type: 'object',
      properties: {
        itemId: {
          type: 'string',
          enum: ['meat', 'fish', 'heart', 'life_potion', 'milk_pot', 'water_pot', 'axe', 'pickaxe'],
          description: 'Item to buy',
        },
        reason: { type: 'string', description: 'Why you are buying this item' },
      },
      required: ['itemId', 'reason'],
    },
  },
  {
    name: 'wait',
    description: 'Do nothing this tick. Use when waiting for a node to respawn.',
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
- Merchant at (34, 33) — go_to (34, 34) approaching from south (dir=up), then interact to SELL ALL resources for gold
- Guard    (43, 33) — dialog only
- Elder    (40, 26) — dialog only
- Hunter   (15, 35) — dialog only
- Hermit   (61, 60) — dialog only

### Chests
- Chest (38, 33) — may contain tools
- Chest (31, 32) — may contain items
- Chest (48, 43) — may contain items
- Chest (5, 10)  — may contain items
- Chests can only be looted ONCE. After opening, they are permanently empty. Do not revisit an opened chest.

### Harvest Nodes
IMPORTANT: To harvest a node at (X,Y) you must stand ONE TILE NORTH at (X, Y-1) and face DOWN.
Do NOT go_to the node's tile itself — go_to (X, Y-1), then interact facing down.

Bushes (no tool needed, 1 hit, drops grass):
  node (38,36) → stand at (38,35) facing down
  node (42,36) → stand at (42,35) facing down
  node (30,30) → stand at (30,29) facing down
  node (44,30) → stand at (44,29) facing down
  node (35,45) → stand at (35,44) facing down
  node (48,42) → stand at (48,41) facing down

Trees (need axe, 3 hits = 3 separate interact actions, drops plank/branch):
  node (8,10)  → stand at (8,9)   facing down
  node (14,8)  → stand at (14,7)  facing down
  node (22,35) → stand at (22,34) facing down

Rock nodes (need pickaxe, 4 hits, drops rock/bar_iron/gem):
  node (29,24) → stand at (29,23) facing down
  node (50,26) → stand at (50,25) facing down

### Economy
- To sell: go_to (34, 34) faceDir "up", then interact — sells ALL resources automatically
- Sell prices: grass=1g, plank=2g, branch=1g, rock=1g, bar_iron=6g, gem_red=12g, gem_green=10g, bar_gold=18g
- To buy: go_to (34, 34) faceDir "up", then use buy tool with itemId
- Buy prices: meat=4g (+15 HP), fish=3g (+10 HP), heart=5g (+20 HP), life_potion=8g (+40 HP), milk_pot=6g (+30 EN)
- To eat: call eat tool any time you have food/potions in inventory

### Survival
- HP drains 3 every 30 seconds (hunger). HP does NOT regen in the safe zone.
- Hostile zones drain an extra 2 HP + 2 energy every 20 seconds.
- Energy recovers 2 every 20 seconds in Shinobi Village only.
- If HP reaches 0 you die and respawn at (40,35) with full HP but lose nothing.
- Strategy: harvest → sell → buy food → eat → repeat. Keep HP above 40 at all times.
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

### Strategy (check in order — STOP at first match)
0. If "facing" field is NOT null (type:"harvest", "npc", or "chest") → call interact IMMEDIATELY.
1. If HP < 60 AND have food/potion in inventory → call eat immediately.
2. If HP < 60 AND no food AND gold >= 3 → go_to (34,34) faceDir "up", then buy fish (3g) or meat (4g).
3. If HP < 60 AND no food AND gold < 3 → go harvest (DO NOT stay at merchant; go to bush nodes to earn gold).
4. If carrying resources (grass/plank/rock/bar_iron/gem): go_to (34,34) faceDir "up" to sell to Merchant.
5. After selling, if HP < 80 and gold >= 3: buy food at merchant (you're already there).
6. If you need tools: go_to (38,34) faceDir "up" to open chest. If opened, try (31,32) faceDir "up".
7. To harvest: go_to the stand tile (X, Y-1) with faceDir "down", then interact when facing shows the node.
8. NEVER go_to a chest in recentHistory marked "opened" or "empty".
9. If facing is null — reposition with go_to before interacting.

### Reading recentHistory
The observation includes a "recentHistory" field — your last 8 decisions and their outcomes.
Use it to avoid repeating failed actions. If you went to a location and got "chest is empty",
that chest is permanently looted — cross it off and pick a different goal.

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
- Check your inventory first. If you have axe+pickaxe, skip all chests and harvest.
- Chests are one-time loot. If recentHistory shows a chest was "empty", never return to it.
- CRITICAL: To harvest node at (X,Y) you must stand ADJACENT (e.g. one tile south at Y+1) and face it.
  Use the "stand at" coordinates from the map above, NOT the node tile itself.
- Only interact when "facing" shows a node/chest/npc — if facing is null, reposition first.
- Harvest bushes (no tool), trees (need axe), rocks (need pickaxe)
- Sell resources at Merchant (34,33)
- Stay near spawn (40,35) when HP is low (safe zone regens HP)
- recentHistory in the observation shows your last decisions — use it to avoid loops.

Reply with ONLY the action word. No explanation.`;

export function buildUserPrompt(snapshot, history = []) {
  const { hp, maxHp, energy } = snapshot.player ?? {};
  const FOOD_IDS = new Set(['meat','fish','honey','heart','life_potion','milk_pot','water_pot']);
  const hasFood = snapshot.inventory?.some(i => FOOD_IDS.has(i.id));
  const SELLABLE = new Set(['grass','plank','branch','rock','bar_iron','bar_gold','gem_red','gem_green']);
  const hasResources = snapshot.inventory?.some(i => SELLABLE.has(i.id));

  const gold = snapshot.gold ?? 0;
  const warnings = [];
  if (hp <= 30)       warnings.push(`⚠ CRITICAL HP ${hp}/${maxHp} — EAT NOW or you will die`);
  else if (hp <= 60)  warnings.push(`⚠ LOW HP ${hp}/${maxHp}`);

  if (hp <= 60 && hasFood)
    warnings.push(`→ ACTION: call eat (you have food in inventory)`);
  else if (hp <= 60 && !hasFood && gold >= 3)
    warnings.push(`→ ACTION: buy fish (3g) or meat (4g) at merchant — you have ${gold}g`);
  else if (hp <= 60 && !hasFood && gold < 3)
    warnings.push(`→ ACTION: go harvest grass (2 bushes) to earn gold, then buy food — DO NOT stay at merchant`);

  if (hasResources && hp > 60)
    warnings.push(`→ ACTION: sell resources at merchant (34,34), then buy food if HP < 80`);

  const obs = { ...snapshot, recentHistory: history };
  const prefix = warnings.length ? `PRIORITY ALERTS:\n${warnings.join('\n')}\n\n` : '';
  return prefix + JSON.stringify(obs, null, 2);
}

export function parseAction(raw) {
  const cleaned = raw.trim().toLowerCase().replace(/[`'"*\n]/g, '').split(/\s+/)[0];
  return VALID_ACTIONS.has(cleaned) ? cleaned : 'wait';
}
