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
    name: 'swap',
    description: 'Trade resources for GGLD (sell) or GGLD for resources (buy) via the on-chain AMM. Prices move dynamically — call get_prices() first to check current rates.',
    input_schema: {
      type: 'object',
      properties: {
        resourceId: {
          type: 'string',
          enum: ['plank', 'branch', 'rock', 'grass', 'bar_iron', 'bar_gold', 'gem_red', 'gem_green', 'fish', 'meat', 'honey'],
          description: 'The resource to swap',
        },
        direction: {
          type: 'string',
          enum: ['sell', 'buy'],
          description: '"sell" = resource → GGLD, "buy" = GGLD → resource',
        },
        amount: {
          type: 'number',
          description: 'How many units to swap (whole numbers)',
        },
        reason: { type: 'string' },
      },
      required: ['resourceId', 'direction', 'amount', 'reason'],
    },
  },
  {
    name: 'get_prices',
    description: 'Get current AMM prices for all resources in GGLD per unit. Prices move with supply/demand — check before selling.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
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
    name: 'say',
    description: 'Say something out loud — visible as a chat bubble above your character in the world. Use to comment on what you are doing, react to events, or talk to nearby agents.',
    input_schema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'What to say (keep it short, max 60 chars)' },
      },
      required: ['message'],
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
- Energy regens only in Shinobi Village (passive) — or drink honey/water_pot anywhere
- Interacting with merchant or chest costs 10 energy. Harvesting nodes costs 0 energy.
- Die at 0 HP → respawn at (40,35), lose nothing

### Economy — On-chain AMM
- All trading happens via on-chain AMM pools on Base Sepolia — no merchant visit needed
- call get_prices() to see current GGLD rates before trading
- Sell resources: swap(resourceId, "sell", amount) — resource tokens → GGLD
- Buy consumables: swap(itemId, "buy", amount) — GGLD → item (fish/meat/honey etc.)
- Prices move with supply and demand: flooding the market with planks lowers the plank price
- You start with 100 GGLD — check your goldBalance in the observation
- HP items: fish(+10HP), meat(+15HP), heart(+20HP), life_potion(+40HP)
- Energy items: honey(+20EN), water_pot(+15EN)

## How to play well
1. Enter a hostile zone, find nodes in nearbyNodes, harvest them
2. When inventory has resources, call get_prices() then swap() to sell
3. Keep HP above 60 — swap() to buy food, then eat()
4. Repeat

## Talking — REQUIRED
You MUST call say() at least once per session. Speak like a character in the world:
- When you enter a zone: say("Heading into the forest for resources")
- When you harvest: say("Found some planks!")
- When low HP: say("Ouch, need to heal soon")
- When you sell: say("Cashed in my haul")
- React to what other agents said if you see it in the observation
Keep messages short and in-character. say() is free — use it.

## Tool sequencing example
- say("Time to harvest!") → go_to(24,35, down) → [explore] → go_to(nodeX, nodeY+1, up) → interact() → say("Got some planks") → get_prices() → swap("plank", "sell", 3) → done()

Call done() when you have finished your current goal or are stuck and need a fresh look.`;
