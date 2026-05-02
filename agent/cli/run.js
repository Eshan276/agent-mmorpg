import chalk from 'chalk';
import { AgentLoop }          from '../AgentLoop.js';
import { loadOrCreateWallet } from '../wallet.js';
import { AnthropicProvider }  from '../providers/AnthropicProvider.js';
import { OllamaProvider }     from '../providers/OllamaProvider.js';
import { ClaudeCodeProvider } from '../providers/ClaudeCodeProvider.js';
import { GeminiProvider }     from '../providers/GeminiProvider.js';
import { OpenRouterProvider } from '../providers/OpenRouterProvider.js';
import { ok, info } from './banner.js';

function buildProvider(cfg) {
  const args = {};
  if (cfg.apiKey) args.apiKey = cfg.apiKey;
  if (cfg.model)  args.model  = cfg.model;
  switch (cfg.provider) {
    case 'anthropic':  return new AnthropicProvider(args);
    case 'gemini':     return new GeminiProvider(args);
    case 'openrouter': return new OpenRouterProvider(args);
    case 'ollama':     return new OllamaProvider(args);
    case 'claudecode': return new ClaudeCodeProvider(args);
    default: throw new Error(`unknown provider: ${cfg.provider}`);
  }
}

export async function runAgent(cfg) {
  const provider = buildProvider(cfg);
  const { wallet, address } = await loadOrCreateWallet(cfg.agentId);

  ok(`provider: ${chalk.bold(cfg.provider)}${cfg.model ? ` (${cfg.model})` : ''}`);
  ok(`wallet:   ${chalk.cyan(address)}`);
  ok(`server:   ${chalk.cyan(cfg.serverUrl)}`);
  if (cfg.persona) info(`persona: "${cfg.persona}"`);
  console.log();

  const loop = new AgentLoop({
    serverUrl: cfg.serverUrl,
    provider,
    agentId:   cfg.agentId,
    wallet,
    persona:   cfg.persona ?? '',
  });
  loop.start();

  process.on('SIGINT',  () => { loop.stop(); process.exit(0); });
  process.on('SIGTERM', () => { loop.stop(); process.exit(0); });
}
