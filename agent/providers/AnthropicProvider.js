import Anthropic from '@anthropic-ai/sdk';
import { TOOLS } from '../prompt.js';

export class AnthropicProvider {
  constructor({ apiKey, model = 'claude-haiku-4-5-20251001' }) {
    this._client = new Anthropic({ apiKey });
    this._model  = model;
  }

  /**
   * Returns { tool, input } where tool is the tool name and input is its args.
   * Falls back to { tool: 'wait', input: {} } on any error.
   */
  async complete(systemPrompt, userPrompt) {
    const msg = await this._client.messages.create({
      model:      this._model,
      max_tokens: 256,
      system:     systemPrompt,
      tools:      TOOLS,
      tool_choice: { type: 'any' },
      messages:   [{ role: 'user', content: userPrompt }],
    });

    const toolUse = msg.content.find(b => b.type === 'tool_use');
    if (toolUse) {
      return { tool: toolUse.name, input: toolUse.input ?? {} };
    }
    return { tool: 'wait', input: {} };
  }
}
