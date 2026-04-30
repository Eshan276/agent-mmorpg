// OpenRouterProvider — OpenAI-compatible API, supports any OR model with tool calling
export class OpenRouterProvider {
  constructor({ apiKey, model = 'google/gemini-2.5-flash:google' }) {
    this._apiKey = apiKey;
    this._model  = model;
  }

  async completeWithTools(systemPrompt, messages, tools) {
    const orMessages = this._convertMessages(systemPrompt, messages);
    const orTools    = tools.map(t => ({
      type: 'function',
      function: { name: t.name, description: t.description, parameters: t.input_schema },
    }));

    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${this._apiKey}`,
        'HTTP-Referer':  'https://agent-mmorpg',
      },
      body: JSON.stringify({
        model:       this._model,
        messages:    orMessages,
        tools:       orTools,
        tool_choice: 'auto',
      }),
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`OpenRouter HTTP ${res.status}: ${txt.slice(0, 300)}`);
    }

    const data = await res.json();
    const msg  = data.choices?.[0]?.message ?? {};

    // Convert OpenAI response → Anthropic content blocks
    const content = [];

    if (msg.content) content.push({ type: 'text', text: msg.content });

    if (msg.tool_calls?.length) {
      for (const tc of msg.tool_calls) {
        content.push({
          type:  'tool_use',
          id:    tc.id ?? `or_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          name:  tc.function.name,
          input: typeof tc.function.arguments === 'string'
            ? JSON.parse(tc.function.arguments)
            : tc.function.arguments,
        });
      }
    }

    if (content.length === 0 || !content.some(b => b.type === 'tool_use')) {
      console.log(`[OpenRouter] no tool call returned, ending session. raw: ${JSON.stringify(msg).slice(0, 200)}`);
      content.push({ type: 'tool_use', id: `or_done_${Date.now()}`, name: 'done', input: { summary: 'model returned no tool call' } });
    }

    return { content };
  }

  _convertMessages(systemPrompt, messages) {
    const result = [{ role: 'system', content: systemPrompt }];

    for (const msg of messages) {
      if (msg.role === 'user') {
        if (typeof msg.content === 'string') {
          result.push({ role: 'user', content: msg.content });
        } else if (Array.isArray(msg.content)) {
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

        const out = { role: 'assistant', content: textBlocks.map(b => b.text).join('\n') || null };
        if (toolUses.length) {
          out.tool_calls = toolUses.map(b => ({
            id:   b.id,
            type: 'function',
            function: { name: b.name, arguments: JSON.stringify(b.input) },
          }));
        }
        result.push(out);
      }
    }

    return result;
  }
}
