// ClaudeCodeProvider — deterministic rule-based provider that encodes
// Claude's reasoning directly as JavaScript. No API calls, no subprocess.
// Follows the same rules Claude would apply when reading the observation.

export class ClaudeCodeProvider {
  constructor({ model = 'claude-code' } = {}) {
    this._model = model;
    this._blockedNodes = new Set();   // "tileX,tileY" node keys that are permanently unreachable
    this._failedApproaches = new Set(); // "tileX,tileY" approach tiles that didn't face the node
  }

  async completeWithTools(systemPrompt, messages, tools) {
    const state = this._extractState(messages);


    const tool  = this._decide(state);
    console.log(`[ClaudeCode] state: pos=(${state.tileX},${state.tileY}) zone=${state.zone} hp=${state.hp} inv=[${state.inventory.map(i=>i.id).join(',')}] facing=${state.facingType ?? 'null'} blocked=[${[...this._blockedNodes].join('|')}]`);
    return {
      content: [{
        type:  'tool_use',
        id:    `cc_${Date.now()}`,
        name:  tool.name,
        input: tool.input,
      }],
    };
  }

  // ── Extract current state from message history ─────────────────────────────

  _extractState(messages) {
    // Start from the initial observation string
    let state = {
      tileX: 40, tileY: 35, hp: 100, maxHp: 100,
      energy: 100, gold: 0, zone: 'Shinobi Village',
      inventory: [], facing: null, facingType: null,
      nearbyNodes: [], events: [],
    };

    // Map tool_use_id → node target so stuck results can mark the right node
    const pendingGoTo = new Map(); // tool_use_id → {tileX,tileY}

    for (const msg of messages) {
      if (msg.role === 'assistant' && Array.isArray(msg.content)) {
        for (const block of msg.content) {
          if (block.type === 'tool_use' && block.name === 'go_to') {
            const nx = block.input._nodeTileX ?? null;
            const ny = block.input._nodeTileY ?? null;
            if (nx !== null && ny !== null) {
              pendingGoTo.set(block.id, {
                node: { tileX: nx, tileY: ny },
                approach: { tileX: block.input.tileX, tileY: block.input.tileY },
              });
            }
          }
        }
      }
      if (msg.role === 'user') {
        if (typeof msg.content === 'string') {
          state = { ...state, ...this._parseObsText(msg.content) };
        } else if (Array.isArray(msg.content)) {
          for (const block of msg.content) {
            if (block.type === 'tool_result') {
              try {
                const r = JSON.parse(block.content);
                // Track failed approaches; block the node only when all 4 directions fail
                const entry = pendingGoTo.get(block.tool_use_id);
                if (entry) {
                  const failed = r.stuck || (r.arrived && r.facing?.type !== 'harvest');
                  if (failed) {
                    const aKey = `${entry.approach.tileX},${entry.approach.tileY}`;
                    this._failedApproaches.add(aKey);
                    // Check if all 4 approach directions for this node are now failed
                    const { tileX: nx, tileY: ny } = entry.node;
                    const allApproaches = [
                      `${nx},${ny+1}`, `${nx-1},${ny}`, `${nx+1},${ny}`, `${nx},${ny-1}`,
                    ];
                    const allFailed = allApproaches.every(k => this._failedApproaches.has(k));
                    if (allFailed) {
                      const nKey = `${nx},${ny}`;
                      if (!this._blockedNodes.has(nKey)) {
                        this._blockedNodes.add(nKey);
                        console.log(`[ClaudeCode] node (${nx},${ny}) fully blocked — all approaches failed`);
                      }
                    } else {
                      console.log(`[ClaudeCode] approach (${entry.approach.tileX},${entry.approach.tileY}) failed for node (${nx},${ny}), will try another direction`);
                    }
                  }
                }
                this._applyToolResult(state, r);
              } catch { /* ignore */ }
            }
          }
        }
      }
    }
    return state;
  }

  _parseObsText(text) {
    const state = {};
    const posMatch  = text.match(/Position:\s*\((\d+),(\d+)\)/);
    const zoneMatch = text.match(/Zone:\s*([^\n|]+)/);
    const hpMatch   = text.match(/HP:\s*(\d+)\/(\d+)/);
    const enMatch   = text.match(/Energy:\s*(\d+)\/(\d+)/);
    const goldMatch = text.match(/Gold:\s*(\d+)g/);
    if (posMatch)  { state.tileX = +posMatch[1]; state.tileY = +posMatch[2]; }
    if (zoneMatch) state.zone = zoneMatch[1].trim();
    if (hpMatch)   { state.hp = +hpMatch[1]; state.maxHp = +hpMatch[2]; }
    if (enMatch)   { state.energy = +enMatch[1]; state.maxEnergy = +enMatch[2]; }
    if (goldMatch) state.gold = +goldMatch[1];

    // Inventory
    const invMatch = text.match(/Inventory:\s*([^\n]+)/);
    if (invMatch && invMatch[1].trim() !== 'empty') {
      state.inventory = invMatch[1].split(',').map(s => {
        const m = s.trim().match(/^(.+?)×(\d+)$/);
        return m ? { name: m[1].trim(), id: m[1].trim().toLowerCase().replace(' ', '_'), qty: +m[2] } : null;
      }).filter(Boolean);
    } else {
      state.inventory = [];
    }

    // Facing
    const facingMatch = text.match(/Facing:\s*([^\n]+)/);
    if (facingMatch && facingMatch[1].trim() !== 'nothing') {
      const ft = facingMatch[1].trim();
      state.facingType = ft.split(' ')[0];
      state.facing = ft;
    }

    // Nearby nodes
    const nodesMatch = text.match(/Nearby nodes:\s*([^\n]+)/);
    state.nearbyNodes = [];
    if (nodesMatch && nodesMatch[1].trim() !== 'none') {
      for (const part of nodesMatch[1].split(',')) {
        const m = part.trim().match(/(\w+)@\((\d+),(\d+)\)/);
        if (m) state.nearbyNodes.push({ resourceType: m[1], tileX: +m[2], tileY: +m[3], depleted: false });
      }
    }

    return state;
  }

  _applyToolResult(state, r) {
    if (r.tileX !== undefined) { state.tileX = r.tileX; state.tileY = r.tileY; }
    if (r.zone)      state.zone = r.zone;
    if (r.hp !== undefined)   state.hp = r.hp;
    if (r.gold !== undefined) state.gold = r.gold;
    if (r.inventory) state.inventory = r.inventory;
    if (r.nearbyNodes) state.nearbyNodes = r.nearbyNodes.filter(n => !n.depleted);
    if (r.events)    state.events = r.events;

    // facing from tool result
    if ('facing' in r) {
      state.facing    = r.facing;
      state.facingType = r.facing?.type ?? null;
    }

  }

  // ── Decision logic — same rules I'd apply reading the observation ───────────

  _decide(s) {
    const inv = s.inventory ?? [];
    const hasAxe       = inv.some(i => i.id === 'axe');
    const hasPickaxe   = inv.some(i => i.id === 'pickaxe');
    const FOOD_IDS     = new Set(['meat','fish','honey','heart','life_potion','milk_pot','water_pot']);
    const RESOURCE_IDS = new Set(['grass','plank','branch','rock','bar_iron','bar_gold','gem_red','gem_green']);
    const hasFood      = inv.some(i => FOOD_IDS.has(i.id));
    const hasResources = inv.some(i => RESOURCE_IDS.has(i.id));

    // 1. Facing a harvest node → interact
    if (s.facingType === 'harvest') {
      return this._tool('interact', { reason: `harvesting ${s.facing?.resourceType ?? 'node'}` });
    }

    // 2. Facing unopened chest → interact
    if (s.facingType === 'chest') {
      return this._tool('interact', { reason: 'opening chest for tools' });
    }

    // 3. Facing merchant AND have resources → sell
    if ((s.facingType === 'npc') && hasResources) {
      return this._tool('interact', { reason: 'selling resources to merchant' });
    }

    // 4. Low HP and have food → eat
    if (s.hp <= 60 && hasFood) {
      return this._tool('eat', { reason: `hp=${s.hp}, eating food` });
    }


    // 7. Low HP, no food, have gold → buy food
    if (s.hp <= 60 && !hasFood && s.gold >= 3) {
      return this._tool('go_to', { tileX: 34, tileY: 34, facingDir: 'up', reason: 'buying food (low hp)' });
    }

    // 8. Nearby undepleted node → go harvest it (pick closest harvestable)
    // Skip nodes too close to map edges (can't approach them)
    const nodes = (s.nearbyNodes ?? []).filter(n =>
      !n.depleted &&
      n.tileX > 1 && n.tileY > 1 && n.tileX < 78 && n.tileY < 78 &&
      !this._blockedNodes.has(`${n.tileX},${n.tileY}`)
    );

    // 5. Have resources AND (batched enough OR no more nodes nearby) → go sell
    const resourceCount = inv.filter(i => RESOURCE_IDS.has(i.id)).reduce((sum, i) => sum + i.qty, 0);
    const noMoreNodes   = nodes.length === 0;
    if (hasResources && (resourceCount >= 5 || noMoreNodes)) {
      return this._tool('go_to', { tileX: 34, tileY: 34, facingDir: 'up', reason: 'selling resources' });
    }
    if (nodes.length > 0) {
      // Sort harvestable nodes by distance, try each until we find one with a valid approach
      const harvestable = nodes
        .filter(n => {
          if (n.resourceType === 'tree')      return hasAxe;
          if (n.resourceType === 'rock_node') return hasPickaxe;
          return true;
        })
        .sort((a, b) => {
          const da = Math.abs(a.tileX - s.tileX) + Math.abs(a.tileY - s.tileY);
          const db = Math.abs(b.tileX - s.tileX) + Math.abs(b.tileY - s.tileY);
          return da - db;
        });

      for (const target of harvestable) {
        const approaches = [
          { tileX: target.tileX,     tileY: target.tileY + 1, facingDir: 'up'    },
          { tileX: target.tileX - 1, tileY: target.tileY,     facingDir: 'right' },
          { tileX: target.tileX + 1, tileY: target.tileY,     facingDir: 'left'  },
          { tileX: target.tileX,     tileY: target.tileY - 1, facingDir: 'down'  },
        ].filter(a =>
          a.tileX >= 0 && a.tileY >= 0 && a.tileX < 80 && a.tileY < 80 &&
          !this._failedApproaches.has(`${a.tileX},${a.tileY}`)
        );

        if (approaches.length === 0) continue; // all directions failed — try next node

        return this._tool('go_to', {
          tileX: approaches[0].tileX, tileY: approaches[0].tileY,
          facingDir: approaches[0].facingDir,
          reason: `harvesting ${target.resourceType} at (${target.tileX},${target.tileY})`,
          _nodeTileX: target.tileX, _nodeTileY: target.tileY,
        });
      }
    }

    // 9. In village with no nodes visible → go to Forest of Whispers
    const HOSTILE = new Set(['Forest of Whispers','Crystal Lake','Sunken Sands Desert','Mountain Pass']);
    if (!HOSTILE.has(s.zone)) {
      return this._tool('go_to', { tileX: 24, tileY: 35, facingDir: 'down', reason: 'entering Forest of Whispers' });
    }

    // 10. In hostile zone, no nodes visible → explore deeper
    const EXPLORE = {
      'Forest of Whispers':  [{ tileX: 10, tileY: 10 }, { tileX: 5, tileY: 30 }, { tileX: 20, tileY: 20 }],
      'Crystal Lake':        [{ tileX: 60, tileY: 10 }, { tileX: 65, tileY: 25 }],
      'Sunken Sands Desert': [{ tileX: 62, tileY: 60 }, { tileX: 70, tileY: 70 }],
      'Mountain Pass':       [{ tileX: 10, tileY: 65 }, { tileX: 15, tileY: 70 }],
    };
    const spots = EXPLORE[s.zone] ?? [{ tileX: 24, tileY: 35 }];
    // Pick furthest unvisited spot from current position
    const dest = spots.reduce((a, b) => {
      const da = Math.abs(a.tileX - s.tileX) + Math.abs(a.tileY - s.tileY);
      const db = Math.abs(b.tileX - s.tileX) + Math.abs(b.tileY - s.tileY);
      return da >= db ? a : b;
    });
    return this._tool('go_to', { tileX: dest.tileX, tileY: dest.tileY, facingDir: 'down', reason: 'exploring zone for nodes' });
  }

  _tool(name, input) { return { name, input }; }
}
