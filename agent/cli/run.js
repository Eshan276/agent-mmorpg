import chalk from 'chalk';
import { AgentLoop }          from '../AgentLoop.js';
import { loadOrCreateWallet } from '../wallet.js';
import { AnthropicProvider }  from '../providers/AnthropicProvider.js';
import { OllamaProvider }     from '../providers/OllamaProvider.js';
import { ClaudeCodeProvider } from '../providers/ClaudeCodeProvider.js';
import { GeminiProvider }     from '../providers/GeminiProvider.js';
import { OpenRouterProvider } from '../providers/OpenRouterProvider.js';
import { startAxl, stopAxl }  from './axl.js';
import { ok, info, dim }      from './banner.js';

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

  // Start the AXL spoke (best-effort — agent works without it)
  let axl = null;
  try {
    axl = await startAxl(cfg.agentId, cfg.serverUrl);
    if (axl?.ready) ok(`axl peer: ${chalk.magenta(axl.peerId.slice(0, 12) + '…')}`);
    else            dim('axl: disabled (whisper() unavailable)');
  } catch (e) {
    dim(`axl: failed to start (${e.message})`);
  }
  console.log();

  const loop = new AgentLoop({
    serverUrl: cfg.serverUrl,
    provider,
    agentId:   cfg.agentId,
    wallet,
    persona:   cfg.persona ?? '',
    axl,
  });
  loop.start();

  const shutdown = () => { loop.stop(); stopAxl(); process.exit(0); };
  process.on('SIGINT',  shutdown);
  process.on('SIGTERM', shutdown);
}
