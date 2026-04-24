export class OllamaProvider {
  constructor({ baseUrl = 'http://localhost:11434', model = 'llama3' }) {
    this._baseUrl = baseUrl;
    this._model   = model;
  }

  async complete(systemPrompt, userPrompt) {
    const res = await fetch(`${this._baseUrl}/api/chat`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model:   this._model,
        stream:  false,
        options: { num_predict: 100 },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userPrompt   },
        ],
      }),
    });
    if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
    const data = await res.json();
    return data.message?.content ?? 'wait';
  }
}
