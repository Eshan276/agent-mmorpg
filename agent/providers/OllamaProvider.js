import { OLLAMA_SYSTEM_PROMPT } from '../prompt.js';

const OLLAMA_REASON_SYSTEM = OLLAMA_SYSTEM_PROMPT + `

Reply on TWO lines exactly:
Line 1: the action word (move_up / move_down / move_left / move_right / interact / wait)
Line 2: one sentence explaining your goal and why you chose this action

Example:
move_right
Heading to chest at (38,33) to get axe and pickaxe so I can harvest trees.`;

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
        options: { num_predict: 60 },
        messages: [
          { role: 'system', content: OLLAMA_REASON_SYSTEM },
          { role: 'user',   content: userPrompt },
        ],
      }),
    });
    if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
    const data   = await res.json();
    const raw    = (data.message?.content ?? 'wait').trim();

    const lines  = raw.split('\n').map(l => l.trim()).filter(Boolean);
    const action = (lines[0] ?? 'wait').toLowerCase().replace(/[`'"*]/g, '').split(/\s+/)[0];
    const reason = lines[1] ?? '';

    const DIR_MAP = {
      move_up: 'up', move_down: 'down', move_left: 'left', move_right: 'right',
    };
    if (DIR_MAP[action]) return { tool: 'move',     input: { direction: DIR_MAP[action], reason } };
    if (action === 'interact') return { tool: 'interact', input: { reason } };
    return { tool: 'wait', input: { reason } };
  }
}
