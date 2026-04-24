import Anthropic from '@anthropic-ai/sdk';

export class AnthropicProvider {
  constructor({ apiKey, model = 'claude-sonnet-4-6' }) {
    this._client = new Anthropic({ apiKey });
    this._model  = model;
  }

  async complete(systemPrompt, userPrompt) {
    const msg = await this._client.messages.create({
      model:      this._model,
      max_tokens: 256,
      system:     systemPrompt,
      messages:   [{ role: 'user', content: userPrompt }],
    });
    return msg.content[0]?.text ?? 'wait';
  }
}
