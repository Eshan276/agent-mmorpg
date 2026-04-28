// GeminiProvider — uses Google Gemini native function calling API
// Converts Anthropic tool format → Gemini format and back.

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export class GeminiProvider {
  constructor({ apiKey, model = 'gemini-2.5-flash' }) {
    this._apiKey = apiKey;
    this._model  = model;
  }

  async completeWithTools(systemPrompt, messages, tools) {
    const geminiTools    = [{ function_declarations: tools.map(t => this._convertTool(t)) }];
    const geminiContents = this._convertMessages(messages);

    const body = {
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents:   geminiContents,
      tools:      geminiTools,
      toolConfig: { function_calling_config: { mode: 'AUTO' } },
    };

    const res = await fetch(
      `${GEMINI_API_BASE}/${this._model}:generateContent?key=${this._apiKey}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    );

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Gemini HTTP ${res.status}: ${txt.slice(0, 300)}`);
    }

    const data = await res.json();
    const parts = data.candidates?.[0]?.content?.parts ?? [];

    // Convert Gemini parts → Anthropic content blocks
    const content = [];

    for (const part of parts) {
      if (part.text) {
        content.push({ type: 'text', text: part.text });
      } else if (part.functionCall) {
        content.push({
          type:  'tool_use',
          id:    `gemini_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          name:  part.functionCall.name,
          input: part.functionCall.args ?? {},
        });
      }
    }

    if (content.length === 0 || !content.some(b => b.type === 'tool_use')) {
      const raw = JSON.stringify(parts).slice(0, 200);
      console.log(`[Gemini] no tool call returned, ending session. raw: ${raw}`);
      content.push({
        type:  'tool_use',
        id:    `gemini_done_${Date.now()}`,
        name:  'done',
        input: { summary: 'model returned no tool call' },
      });
    }

    return { content };
  }

  // ── Format converters ───────────────────────────────────────────────────────

  _convertTool(t) {
    // Gemini wants parameters without the $schema wrapper, just plain JSON schema
    const params = { ...t.input_schema };
    return { name: t.name, description: t.description, parameters: params };
  }

  _convertMessages(messages) {
    const result = [];

    for (const msg of messages) {
      if (msg.role === 'user') {
        if (typeof msg.content === 'string') {
          result.push({ role: 'user', parts: [{ text: msg.content }] });
        } else if (Array.isArray(msg.content)) {
          // Tool results — Gemini uses functionResponse parts
          const parts = msg.content
            .filter(b => b.type === 'tool_result')
            .map(b => ({
              functionResponse: {
                name:     b._toolName ?? 'unknown',
                response: { result: typeof b.content === 'string' ? b.content : JSON.stringify(b.content) },
              },
            }));
          if (parts.length) result.push({ role: 'user', parts });
        }
      } else if (msg.role === 'assistant' && Array.isArray(msg.content)) {
        const parts = [];
        for (const block of msg.content) {
          if (block.type === 'text' && block.text) {
            parts.push({ text: block.text });
          } else if (block.type === 'tool_use') {
            parts.push({ functionCall: { name: block.name, args: block.input } });
          }
        }
        if (parts.length) result.push({ role: 'model', parts });
      }
    }

    return result;
  }
}
