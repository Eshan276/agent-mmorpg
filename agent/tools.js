// Tool definitions for the LLM — describes every action the agent can take.
// The LLM calls these in sequence within one planning session.

export const TOOLS = [
  {
    name: 'go_to',
    description: 'Walk to a tile. Blocks until you arrive. Use tileX/tileY of the tile you want to STAND ON. Use facingDir to face the right direction on arrival (e.g. "up" to face a chest/NPC/node that is north of you).',
    input_schema: {
      type: 'object',
      properties: {
        tileX:     { type: 'number', description: 'Tile X to walk to' },
        tileY:     { type: 'number', description: 'Tile Y to walk to' },
        facingDir: { type: 'string', enum: ['up','down','left','right'], description: 'Direction to face on arrival' },
        reason:    { type: 'string', description: 'Why you are going here' },
      },
      required: ['tileX', 'tileY', 'facingDir', 'reason'],
    },
  },
  {
    name: 'interact',
    description: 'Interact with whatever you are currently facing. Harvests a node, opens a chest, or sells all resources to the merchant. Only works when facing field is not null.',
    input_schema: {
      type: 'object',
      properties: {
        reason: { type: 'string' },
      },
      required: ['reason'],
    },
  },
  {
    name: 'eat',
    description: 'Eat a food item from your inventory to restore HP.',
    input_schema: {
      type: 'object',
      properties: {
        reason: { type: 'string' },
      },
      required: ['reason'],
    },
  },
  {
    name: 'buy',
    description: 'Buy an item from the merchant. You must be facing the merchant first (go_to (34,34) facingDir="up").',
    input_schema: {
      type: 'object',
      properties: {
        itemId: {
          type: 'string',
          enum: ['fish', 'meat', 'heart', 'life_potion'],
          description: 'fish=3g(+10HP)  meat=4g(+15HP)  heart=5g(+20HP)  life_potion=8g(+40HP)',
        },
        reason: { type: 'string' },
      },
      required: ['itemId', 'reason'],
    },
  },
  {
    name: 'check_status',
    description: 'Get your current HP, energy, gold, inventory, zone and position. Use to make decisions.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'done',
    description: 'Signal you are finished planning for this cycle. Call this when you have completed your current goal or need a fresh observation to decide next steps.',
    input_schema: {
      type: 'object',
      properties: {
        summary: { type: 'string', description: 'What you accomplished this cycle' },
      },
      required: ['summary'],
    },
  },
];

export const SYSTEM_PROMPT = `\
You are an autonomous agent in a 2D pixel MMORPG. You receive a game observation and call tools to act.
You can call multiple tools in sequence to complete a goal — keep going until you call done().

## World

### Zones
- Shinobi Village — SAFE, energy regens here, NO harvest nodes
- Forest of Whispers, Crystal Lake, Sunken Sands Desert, Mountain Pass — HOSTILE, nodes spawn here

### Key locations (tile coordinates)
- Spawn: (40, 35)
- Merchant: (34, 33) — stand at (34, 34) facingDir="up" → interact to sell ALL resources
- Chest: (38, 33) — stand at (38, 34) facingDir="up" → interact to open (one-time loot)
- Other chests: (31, 32), (48, 43), (5, 10) — also one-time

### Zone entry points (walk here to leave Shinobi Village)
- Forest of Whispers:  (24, 35)
- Crystal Lake:        (54, 17)
- Sunken Sands Desert: (54, 53)
- Mountain Pass:       (19, 58)

### Harvesting
- Nodes appear in nearbyNodes once you are in a hostile zone
- Node at (X, Y) → go_to tileX=X tileY=Y+1 facingDir="up", then interact
- bush: no tool needed → grass, honey
- tree: needs axe → plank, branch
- rock_node: needs pickaxe → rock, bar_iron, gem

### Survival
- HP drains 3 every 30s. Hostile zones drain extra 2 HP + 2 energy every 20s.
- HP does NOT regen — eat food to heal
- Energy regens only in Shinobi Village
- Die → respawn at (40,35), lose nothing

### Economy
- Sell: go_to (34,34) facingDir="up" → interact → sells everything automatically
- Buy: go_to (34,34) facingDir="up" → buy(itemId)
- Sell prices: grass=1g, plank=2g, branch=1g, rock=1g, bar_iron=6g, gem=10-18g
- Buy prices: fish=3g, meat=4g, heart=5g, life_potion=8g

## How to play well
1. Get tools first: go_to (38,34) facingDir="up" → interact
2. Enter a hostile zone, find nodes in nearbyNodes, harvest them
3. When inventory has resources, go sell
4. Keep HP above 60 — buy and eat food
5. Repeat

## Tool sequencing example
- go_to(38,34, up) → interact() → go_to(24,35, down) → [explore] → go_to(nodeX, nodeY+1, up) → interact() → go_to(34,34, up) → interact() → done()

Call done() when you have finished your current goal or are stuck and need a fresh look.`;
