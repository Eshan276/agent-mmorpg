// Ollama doesn't support native multi-turn tool use, so we:
// 1. Collapse message history into a single user prompt
// 2. Ask for one JSON action
// 3. Wrap the result as a fake tool_use response so AgentLoop works identically

const OLLAMA_TOOLS_PROMPT = `\
You are an agent in a 2D MMORPG. Output EXACTLY one JSON action object.

Available actions:
{"action":"go_to","tileX":<n>,"tileY":<n>,"facingDir":"up|down|left|right","reason":"<why>"}
{"action":"interact","reason":"<why>"}
{"action":"eat","reason":"<why>"}
{"action":"buy","itemId":"fish|meat|heart|life_potion","reason":"<why>"}
{"action":"check_status"}
{"action":"done","summary":"<what you did>"}

RULES (check in order):
1. facing is harvest node → interact
2. facing is chest (not opened) → interact
3. facing is merchant AND inventory has resources (grass/plank/rock/bar_iron/gem/branch) → interact to sell
4. hp < 70 and have food → eat
5. have resources (grass/plank/rock/bar_iron/gem/branch/plank) → go_to tileX=34 tileY=34 facingDir=up (sell)
6. no axe and no pickaxe → go_to tileX=38 tileY=34 facingDir=up (get tools)
7. hp < 60 and no food and gold >= 3 → go_to tileX=34 tileY=34 facingDir=up (buy food)
8. nearbyNodes has undepleted node at (X,Y) → go_to tileX=X tileY=Y+1 facingDir=up
9. else → go_to zone entry: Forest tileX=24 tileY=35, Crystal tileX=54 tileY=17

KEY FACTS:
- Merchant at (34,33): stand at (34,34) facingDir=up → interact to sell all resources
- Chest at (38,33): stand at (38,34) facingDir=up → interact to open
- Nodes are NORTH of stand position: node at (X,Y) → stand at (X,Y+1) facingDir=up
- Shinobi Village has NO nodes — go to hostile zones to find them
- If tool_result shows "facing: null" after going somewhere, call go_to again with correct coords

Output ONE JSON object only. No explanation.`;

export class OllamaProvider {
  constructor({ baseUrl = 'http://localhost:11434', model = 'llama3' }) {
    this._baseUrl = baseUrl;
    this._model   = model;
  }

  // Multi-turn interface — collapses history into one prompt, returns fake tool_use response
  async completeWithTools(systemPrompt, messages, tools) {
    const userContent = this._collapseMessages(messages);
    const action = await this._callOllama(userContent);
    return this._wrapAsResponse(action);
  }

  _collapseMessages(messages) {
    // Use only the initial observation + the last tool result as current state.
    // Small models get confused by long histories — give them just what they need now.
    let initialObs = '';
    let lastToolResult = null;
    let lastAction = null;

    for (const msg of messages) {
      if (msg.role === 'user') {
        if (typeof msg.content === 'string') {
          initialObs = msg.content;
        } else if (Array.isArray(msg.content)) {
          for (const block of msg.content) {
            if (block.type === 'tool_result') lastToolResult = block.content;
          }
        }
      } else if (msg.role === 'assistant' && Array.isArray(msg.content)) {
        for (const block of msg.content) {
          if (block.type === 'tool_use') lastAction = `${block.name}(${JSON.stringify(block.input)})`;
        }
      }
    }

    // If we have a last tool result, parse it and rebuild a clean state summary
    if (lastToolResult) {
      try {
        const r = JSON.parse(lastToolResult);
        const parts = [];
        if (lastAction) parts.push(`Last action: ${lastAction}`);

        // Rebuild a clean state from the tool result fields
        const state = [];
        if (r.tileX !== undefined) state.push(`Position: (${r.tileX},${r.tileY})`);
        if (r.zone)      state.push(`Zone: ${r.zone}`);
        if (r.hp !== undefined) state.push(`HP: ${r.hp}`);
        if (r.gold !== undefined) state.push(`Gold: ${r.gold}g`);
        if (r.inventory) state.push(`Inventory: ${r.inventory.length ? r.inventory.map(i=>`${i.name}×${i.qty}`).join(', ') : 'empty'}`);
        if (r.facing)    state.push(`Facing: ${r.facing.type}${r.facing.resourceType ? ' ('+r.facing.resourceType+')' : r.facing.id ? ' ('+r.facing.id+')' : ''}`);
        else             state.push('Facing: nothing');
        if (r.nearbyNodes?.length) state.push(`Nearby nodes: ${r.nearbyNodes.filter(n=>!n.depleted).map(n=>`${n.resourceType}@(${n.tileX},${n.tileY})`).join(', ')}`);
        if (r.events?.length) state.push(`Events: ${r.events.join('; ')}`);

        parts.push(state.join(' | '));
        return parts.join('\n');
      } catch { /* fall through to original obs */ }
    }

    return initialObs;
  }

  async _callOllama(userPrompt) {
    const res = await fetch(`${this._baseUrl}/api/chat`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model:   this._model,
        stream:  false,
        format:  'json',
        options: { num_predict: 150, temperature: 0.1 },
        messages: [
          { role: 'system', content: OLLAMA_TOOLS_PROMPT },
          { role: 'user',   content: userPrompt },
        ],
      }),
    });
    if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
    const data = await res.json();
    return (data.message?.content ?? '').trim();
  }

  _wrapAsResponse(raw) {
    const parsed = this._parse(raw);
    return {
      content: [{
        type:  'tool_use',
        id:    `ollama_${Date.now()}`,
        name:  parsed.tool,
        input: parsed.input,
      }],
    };
  }

  _parse(raw) {
    const start = raw.indexOf('{');
    if (start === -1) return { tool: 'done', input: { summary: 'no JSON from model' } };
    let depth = 0, end = -1;
    for (let i = start; i < raw.length; i++) {
      if (raw[i] === '{') depth++;
      else if (raw[i] === '}') { if (--depth === 0) { end = i; break; } }
    }
    if (end === -1) return { tool: 'done', input: { summary: 'malformed JSON' } };

    let jsonStr = raw.slice(start, end + 1);
    jsonStr = jsonStr.replace(/"(\w+):(\s*[\d\w-])/g, '"$1":$2');
    let parsed;
    try { parsed = JSON.parse(jsonStr); }
    catch { return { tool: 'done', input: { summary: 'invalid JSON: ' + jsonStr.slice(0, 60) } }; }

    const reason = parsed.reason ?? '';
    switch (parsed.action) {
      case 'go_to': {
        const tx = parseInt(parsed.tileX), ty = parseInt(parsed.tileY);
        if (isNaN(tx) || isNaN(ty)) return { tool: 'done', input: { summary: 'bad coords' } };
        const facingDir = ['up','down','left','right'].includes(parsed.facingDir) ? parsed.facingDir : 'up';
        return { tool: 'go_to', input: { tileX: tx, tileY: ty, facingDir, reason } };
      }
      case 'interact':     return { tool: 'interact',     input: { reason } };
      case 'eat':          return { tool: 'eat',          input: { reason } };
      case 'check_status': return { tool: 'check_status', input: {} };
      case 'done':         return { tool: 'done',         input: { summary: parsed.summary ?? reason } };
      case 'buy': {
        const itemId = parsed.itemId ?? '';
        if (!itemId) return { tool: 'done', input: { summary: 'buy missing itemId' } };
        return { tool: 'buy', input: { itemId, reason } };
      }
      default:
        return { tool: 'done', input: { summary: 'unknown action: ' + parsed.action } };
    }
  }
}
