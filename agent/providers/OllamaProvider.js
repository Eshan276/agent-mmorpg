const OLLAMA_JSON_SYSTEM = `\
You are an agent in a 2D MMORPG. Each turn output EXACTLY one JSON object, nothing else.

Formats:
{"action":"go_to","tileX":<n>,"tileY":<n>,"faceDir":"<dir>","reason":"<why>"}
{"action":"interact","reason":"<why>"}
{"action":"eat","reason":"<why>"}
{"action":"buy","itemId":"<id>","reason":"<why>"}
{"action":"wait","reason":"<why>"}

Key locations:
- (38,35) faceDir "down" → harvest bush (grass, no tool)
- (42,35) faceDir "down" → harvest bush (grass, no tool)
- (34,34) faceDir "up"  → SELL all resources OR BUY food from merchant
- (38,34) faceDir "up"  → open chest (axe, pickaxe)
- (8,9)   faceDir "down" → chop tree (need axe, drops plank)
- (22,34) faceDir "down" → chop tree (need axe, drops plank)
- (29,23) faceDir "down" → mine rock (need pickaxe, drops iron/gem)

SURVIVAL: HP drains 3 every 30s (hunger). HP does NOT regen. Must eat food to heal.
Buy prices at merchant: fish=3g (+10HP), meat=4g (+15HP), heart=5g (+20HP), life_potion=8g (+40HP)

DECISION RULES (check in order — STOP at first match):
0. If "facing" shows "npc"/"chest"/"harvest" → INTERACT immediately.
1. If inventory has food (meat/fish/heart/life_potion) AND hp < 80 → EAT immediately.
2. If hp < 60 AND no food AND gold >= 3 → go_to (34,34) faceDir "up", buy fish (3g) or meat (4g).
3. If hp < 60 AND no food AND gold < 3 → go_to (38,35) faceDir "down" to harvest grass URGENTLY (need gold for food).
4. If inventory has sellable resources (grass/plank/rock/bar_iron/gem) → go_to (34,34) faceDir "up" to sell.
5. After selling: if hp < 80 and gold >= 3 → buy fish or meat (you are already at merchant).
6. If no tools → go_to (38,34) faceDir "up" to open chest.
7. If have axe → go_to (8,9) faceDir "down" to chop tree.
8. Otherwise → go_to (38,35) faceDir "down" to harvest bush.

Examples:
{"action":"eat","reason":"hp is 35, eating meat to survive"}
{"action":"buy","itemId":"fish","reason":"hp is 40, buying food at merchant"}
{"action":"go_to","tileX":34,"tileY":34,"faceDir":"up","reason":"sell resources to merchant"}
{"action":"go_to","tileX":38,"tileY":35,"faceDir":"down","reason":"harvest bush for grass"}
{"action":"interact","reason":"facing bush, harvesting"}`;

export class OllamaProvider {
  constructor({ baseUrl = 'http://localhost:11434', model = 'llama3' }) {
    this._baseUrl = baseUrl;
    this._model   = model;
  }

  async complete(_systemPrompt, userPrompt) {
    const res = await fetch(`${this._baseUrl}/api/chat`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model:   this._model,
        stream:  false,
        format:  'json',
        options: { num_predict: 200, temperature: 0.2 },
        messages: [
          { role: 'system', content: OLLAMA_JSON_SYSTEM },
          { role: 'user',   content: userPrompt },
        ],
      }),
    });
    if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
    const data = await res.json();
    const raw = (data.message?.content ?? '').trim();

    return this._parse(raw);
  }

  _parse(raw) {
    // Extract first balanced JSON object from response
    const start = raw.indexOf('{');
    if (start === -1) return { tool: 'wait', input: { reason: 'no JSON: ' + raw.slice(0, 60) } };
    let depth = 0, end = -1;
    for (let i = start; i < raw.length; i++) {
      if (raw[i] === '{') depth++;
      else if (raw[i] === '}') { if (--depth === 0) { end = i; break; } }
    }
    if (end === -1) return { tool: 'wait', input: { reason: 'unclosed JSON' } };
    const match = [raw.slice(start, end + 1)];

    let parsed;
    let jsonStr = match[0];
    // Fix common model error: "tileY:35 → "tileY":35 (missing closing quote on key)
    jsonStr = jsonStr.replace(/"(\w+):(\s*[\d\w-])/g, '"$1":$2');
    try { parsed = JSON.parse(jsonStr); }
    catch { return { tool: 'wait', input: { reason: 'invalid JSON: ' + jsonStr.slice(0, 60) } }; }

    const reason = parsed.reason ?? '';

    if (parsed.action === 'go_to') {
      const tx = parseInt(parsed.tileX);
      const ty = parseInt(parsed.tileY);
      if (isNaN(tx) || isNaN(ty)) return { tool: 'wait', input: { reason: 'bad go_to coords' } };
      const faceDir = ['up','down','left','right'].includes(parsed.faceDir) ? parsed.faceDir : null;
      return { tool: 'go_to', input: { tileX: tx, tileY: ty, faceDir, reason } };
    }

    if (parsed.action === 'interact') return { tool: 'interact', input: { reason } };
    if (parsed.action === 'harvest')  return { tool: 'interact', input: { reason } };
    if (parsed.action === 'eat')      return { tool: 'eat',      input: { reason } };
    if (parsed.action === 'wait')     return { tool: 'wait',     input: { reason } };

    if (parsed.action === 'buy') {
      const itemId = parsed.itemId ?? '';
      if (!itemId) return { tool: 'wait', input: { reason: 'buy missing itemId' } };
      return { tool: 'buy', input: { itemId, reason } };
    }

    // Model output move_* with tileX/tileY — treat as go_to if coords present
    const MOVE_ACTIONS = new Set(['move_up','move_down','move_left','move_right']);
    if (MOVE_ACTIONS.has(parsed.action) && parsed.tileX != null && parsed.tileY != null) {
      const tx = parseInt(parsed.tileX);
      const ty = parseInt(parsed.tileY);
      if (!isNaN(tx) && !isNaN(ty)) {
        return { tool: 'go_to', input: { tileX: tx, tileY: ty, reason: reason || parsed.action } };
      }
    }

    return { tool: 'wait', input: { reason: 'unrecognised action: ' + parsed.action } };
  }
}
