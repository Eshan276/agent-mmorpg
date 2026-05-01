#!/usr/bin/env node
import { program }              from 'commander';
import { AgentLoop }            from './AgentLoop.js';
import { loadOrCreateWallet }   from './wallet.js';
import { AnthropicProvider }    from './providers/AnthropicProvider.js';
import { OllamaProvider }       from './providers/OllamaProvider.js';
import { ClaudeCodeProvider }   from './providers/ClaudeCodeProvider.js';
import { GeminiProvider }       from './providers/GeminiProvider.js';
import { OpenRouterProvider }   from './providers/OpenRouterProvider.js';

program
  .name('mmorpg-agent')
  .description('LLM agent CLI for agent-mmorpg')
  .option('--server <url>',     'Socket.io server URL',             'http://localhost:3000')
  .option('--provider <name>',  'LLM provider: anthropic | ollama', 'ollama')
  .option('--model <name>',     'Model name (provider-specific)')
  .option('--api-key <key>',    'Anthropic API key (or set ANTHROPIC_API_KEY)')
  .option('--ollama-url <url>', 'Ollama base URL',                   'http://localhost:11434')
  .option('--tick-ms <ms>',     'Milliseconds between LLM ticks',   '1200')
  .option('--agent-id <id>',    'Unique agent identifier',           `agent_${Math.random().toString(36).slice(2, 7)}`)
  .parse();

const opts = program.opts();

let provider;
if (opts.provider === 'anthropic') {
  const apiKey = opts.apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('Error: Anthropic API key required. Use --api-key or set ANTHROPIC_API_KEY env var.');
    process.exit(1);
  }
  const modelArgs = {};
  if (opts.model) modelArgs.model = opts.model;
  provider = new AnthropicProvider({ apiKey, ...modelArgs });
  console.log(`[Agent] Using Anthropic (model: ${opts.model ?? 'claude-haiku-4-5-20251001'}) with tool use`);
} else if (opts.provider === 'claudecode') {
  const modelArgs = {};
  if (opts.model) modelArgs.model = opts.model;
  provider = new ClaudeCodeProvider({ ...modelArgs });
  console.log(`[Agent] Using ClaudeCode (model: ${opts.model ?? 'claude-sonnet-4-6'})`);
} else if (opts.provider === 'gemini') {
  const apiKey = opts.apiKey ?? process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('Error: Gemini API key required. Use --api-key or set GEMINI_API_KEY env var.');
    process.exit(1);
  }
  const modelArgs = {};
  if (opts.model) modelArgs.model = opts.model;
  provider = new GeminiProvider({ apiKey, ...modelArgs });
  console.log(`[Agent] Using Gemini (model: ${opts.model ?? 'gemini-2.5-flash'})`);
} else if (opts.provider === 'openrouter') {
  const apiKey = opts.apiKey ?? process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error('Error: OpenRouter API key required. Use --api-key or set OPENROUTER_API_KEY env var.');
    process.exit(1);
  }
  const modelArgs = {};
  if (opts.model) modelArgs.model = opts.model;
  provider = new OpenRouterProvider({ apiKey, ...modelArgs });
  console.log(`[Agent] Using OpenRouter (model: ${opts.model ?? 'google/gemini-2.5-flash:google'})`);
} else {
  const modelArgs = {};
  if (opts.model) modelArgs.model = opts.model;
  provider = new OllamaProvider({ baseUrl: opts.ollamaUrl, ...modelArgs });
  console.log(`[Agent] Using Ollama (model: ${opts.model ?? 'llama3'}, url: ${opts.ollamaUrl})`);
}

const { wallet, address } = await loadOrCreateWallet(opts.agentId);

const loop = new AgentLoop({
  serverUrl: opts.server,
  provider,
  agentId:   opts.agentId,
  tickMs:    parseInt(opts.tickMs, 10),
  wallet,
});

console.log(`[Agent] Starting agent "${opts.agentId}" wallet=${address} → ${opts.server}`);
loop.start();

process.on('SIGINT',  () => { loop.stop(); process.exit(0); });
process.on('SIGTERM', () => { loop.stop(); process.exit(0); });
