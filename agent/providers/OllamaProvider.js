// OllamaProvider — uses Ollama's native tool-calling API (qwen2.5 supports it)
// Converts Anthropic tool format → Ollama format, runs multi-turn, converts back.

export class OllamaProvider {
  constructor({ baseUrl = 'http://localhost:11434', model = 'qwen2.5:7b' }) {
    this._baseUrl = baseUrl;
    this._model   = model;
  }

  async completeWithTools(systemPrompt, messages, tools) {
    const ollamaTools   = tools.map(t => this._convertTool(t));
    const ollamaMsgs    = this._convertMessages(systemPrompt, messages);

    const res = await fetch(`${this._baseUrl}/api/chat`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model:    this._model,
        stream:   false,
        tools:    ollamaTools,
        options:  { temperature: 0.3, num_predict: 512 },
        messages: ollamaMsgs,
      }),
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Ollama HTTP ${res.status}: ${txt.slice(0, 200)}`);
    }

    const data = await res.json();
    const msg  = data.message ?? {};

    // Convert Ollama response → Anthropic content blocks
    const content = [];

    if (msg.content) {
      content.push({ type: 'text', text: msg.content });
    }

    if (msg.tool_calls?.length) {
      for (const tc of msg.tool_calls) {
        content.push({
          type:  'tool_use',
          id:    `ollama_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
          name:  tc.function.name,
          input: typeof tc.function.arguments === 'string'
            ? JSON.parse(tc.function.arguments)
            : tc.function.arguments,
        });
      }
    }

    // Fallback: no tool call returned — end session
    if (content.length === 0 || !content.some(b => b.type === 'tool_use')) {
      console.log(`[Ollama] no tool call returned, ending session. raw: ${JSON.stringify(msg).slice(0,200)}`);
      content.push({ type: 'tool_use', id: `ollama_done_${Date.now()}`, name: 'done', input: { summary: 'model returned no tool call' } });
    }

    return { content };
  }

  // ── Format converters ────────────────────────────────────────────────────

  _convertTool(t) {
    return {
      type: 'function',
      function: {
        name:        t.name,
        description: t.description,
        parameters:  t.input_schema,
      },
    };
  }

  _convertMessages(systemPrompt, messages) {
    const result = [{ role: 'system', content: systemPrompt }];

    for (const msg of messages) {
      if (msg.role === 'user') {
        if (typeof msg.content === 'string') {
          result.push({ role: 'user', content: msg.content });
        } else if (Array.isArray(msg.content)) {
          // Tool results — Ollama needs tool_call_id matching the assistant's tool_calls
          for (const block of msg.content) {
            if (block.type === 'tool_result') {
              result.push({
                role:         'tool',
                tool_call_id: block.tool_use_id,
                content:      typeof block.content === 'string' ? block.content : JSON.stringify(block.content),
              });
            }
          }
        }
      } else if (msg.role === 'assistant' && Array.isArray(msg.content)) {
        const textBlocks = msg.content.filter(b => b.type === 'text');
        const toolUses   = msg.content.filter(b => b.type === 'tool_use');

        if (toolUses.length > 0) {
          result.push({
            role: 'assistant',
            content: textBlocks.map(b => b.text).join('\n') || '',
            tool_calls: toolUses.map(b => ({
              id: b.id,
              type: 'function',
              function: {
                name:      b.name,
                arguments: b.input,  // Ollama wants object, not string
              },
            })),
          });
        } else if (textBlocks.length > 0) {
          result.push({ role: 'assistant', content: textBlocks.map(b => b.text).join('\n') });
        }
      }
    }

    return result;
  }
}
