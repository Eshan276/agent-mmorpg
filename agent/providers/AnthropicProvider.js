import Anthropic from '@anthropic-ai/sdk';

export class AnthropicProvider {
  constructor({ apiKey, model = 'claude-haiku-4-5-20251001' }) {
    this._client = new Anthropic({ apiKey });
    this._model  = model;
  }

  // Multi-turn tool-calling. Takes full message history, returns raw response.
  async completeWithTools(systemPrompt, messages, tools) {
    const response = await this._client.messages.create({
      model:       this._model,
      max_tokens:  1024,
      system:      systemPrompt,
      tools,
      tool_choice: { type: 'auto' },
      messages,
    });
    return response;
  }
}
