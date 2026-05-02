#!/usr/bin/env node
import { program } from 'commander';
import chalk       from 'chalk';
import { input, password, select, confirm } from '@inquirer/prompts';
import { ethers }  from 'ethers';

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { printBanner, section, ok, warn, info, err, dim } from './banner.js';
import { configPath, walletPath, loadConfig, saveConfig, configExists, walletExists } from './config.js';
import { loadOrCreateWallet } from '../wallet.js';
import { runAgent }           from './run.js';

const __dir = dirname(fileURLToPath(import.meta.url));
const DEPLOYED_PATH = join(__dir, '..', '..', 'contracts', 'deployed.json');

// Auto-load BASE_SEPOLIA_RPC_URL from contracts/.env (same RPC the deploy scripts use)
// so the CLI uses the dedicated Alchemy endpoint instead of the rate-limited public one.
(function loadEnv() {
  const candidates = [
    join(__dir, '..', '.env'),
    join(__dir, '..', '..', 'contracts', '.env'),
    join(__dir, '..', '..', 'server', '.env'),
  ];
  for (const path of candidates) {
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, 'utf-8').split('\n')) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/i);
      if (!m) continue;
      const [, k, v] = m;
      if (k === 'BASE_SEPOLIA_RPC_URL' && !process.env[k]) {
        process.env[k] = v.replace(/^["']|["']$/g, '');
      }
    }
  }
})();

function loadDeployed() {
  if (!existsSync(DEPLOYED_PATH)) return null;
  try { return JSON.parse(readFileSync(DEPLOYED_PATH, 'utf-8')); } catch { return null; }
}

const ERC20_BALANCE_ABI = ['function balanceOf(address) view returns (uint256)'];

const PROVIDERS = [
  { name: 'Gemini (Google)',         value: 'gemini'      },
  { name: 'Anthropic Claude',        value: 'anthropic'   },
  { name: 'OpenRouter (multi-model)', value: 'openrouter' },
  { name: 'Ollama (local)',           value: 'ollama'     },
  { name: 'ClaudeCode (no API)',      value: 'claudecode' },
];

const PROVIDER_ENV = {
  gemini:     'GEMINI_API_KEY',
  anthropic:  'ANTHROPIC_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
};

// ── init ──────────────────────────────────────────────────────────────────────

async function cmdInit(opts) {
  printBanner();
  section('Agent setup');

  const agentId = await input({
    message: 'Agent name (used as id):',
    default: opts.agentId || 'agent_01',
    validate: v => /^[a-z0-9_-]+$/i.test(v) || 'use letters, digits, _ or - only',
  });

  if (configExists(agentId) && !opts.force) {
    const overwrite = await confirm({
      message: `Config for "${agentId}" already exists at ${configPath(agentId)}. Overwrite?`,
      default: false,
    });
    if (!overwrite) {
      info('Aborted. Run with --force to overwrite, or pick a different agent id.');
      return;
    }
  }

  // ── Wallet ──
  section('Wallet');
  const { wallet, address, provider } = await loadOrCreateWallet(agentId);
  if (walletExists(agentId)) {
    ok(`Loaded existing wallet: ${chalk.bold(address)}`);
    dim(`keyfile: ${walletPath(agentId)}`);
  } else {
    ok(`Created new wallet: ${chalk.bold(address)}`);
    dim(`keyfile: ${walletPath(agentId)} (encrypted)`);
  }

  // Check ETH balance for gas
  let ethBalance = 0n;
  try {
    ethBalance = await provider.getBalance(address);
  } catch { /* RPC may be down — non-fatal */ }
  const ethStr = ethers.formatEther(ethBalance);
  if (ethBalance === 0n) {
    warn(`Wallet has 0 ETH. Agents need a small amount of Base Sepolia ETH to pay gas for swaps.`);
    console.log();
    dim('Get free testnet ETH from any of these faucets:');
    dim('  • https://www.alchemy.com/faucets/base-sepolia');
    dim('  • https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet');
    dim('  • https://faucet.quicknode.com/base/sepolia');
    console.log();
    const wait = await confirm({ message: 'Wait here until the wallet receives ETH?', default: true });
    if (wait) {
      await waitForFunding(provider, address);
    } else {
      warn('Skipped funding. Agent will fail on swap until ETH arrives.');
    }
  } else {
    ok(`ETH balance: ${chalk.bold(ethStr)} ETH (sufficient for gas)`);
  }

  // ── Persona ──
  section('Persona');
  dim('Optional flavor text injected into the agent\'s system prompt.');
  dim('Example: "You are a greedy merchant who hoards gold and trash-talks rivals."');
  const persona = await input({
    message: 'Persona (leave blank for default):',
    default: '',
  });

  // ── Provider ──
  section('LLM provider');
  const providerName = await select({
    message: 'Which LLM provider should drive this agent?',
    choices: PROVIDERS,
  });

  let apiKey, model;
  if (PROVIDER_ENV[providerName]) {
    const envKey = process.env[PROVIDER_ENV[providerName]];
    if (envKey) {
      const useEnv = await confirm({
        message: `Use ${PROVIDER_ENV[providerName]} from environment?`,
        default: true,
      });
      if (useEnv) apiKey = envKey;
    }
    if (!apiKey) {
      apiKey = await password({
        message: `Paste your ${providerName} API key:`,
        mask: '•',
        validate: v => v.length > 5 || 'API key looks too short',
      });
    }
  }
  const customModel = await input({
    message: 'Custom model name (leave blank for provider default):',
    default: '',
  });
  if (customModel) model = customModel;

  // ── Server ──
  section('Game server');
  const serverUrl = await input({
    message: 'Server URL:',
    default: opts.server || 'http://localhost:3000',
  });

  // ── Save ──
  const cfg = {
    agentId,
    serverUrl,
    persona,
    provider:  providerName,
    apiKey:    apiKey   ?? null,
    model:     model    ?? null,
    createdAt: new Date().toISOString(),
  };
  saveConfig(agentId, cfg);
  ok(`Config saved to ${configPath(agentId)}`);

  console.log();
  const startNow = await confirm({ message: 'Run the agent now?', default: true });
  if (startNow) {
    console.log();
    await runAgent(cfg);
  } else {
    info(`Run later with: ${chalk.bold(`agentx run ${agentId}`)}`);
  }
}

// ── run ────────────────────────────────────────────────────────────────────────

async function cmdRun(agentId, opts) {
  printBanner();
  const cfg = loadConfig(agentId);
  if (!cfg) {
    err(`No config for "${agentId}". Run ${chalk.bold(`agentx init --agent-id ${agentId}`)} first.`);
    process.exit(1);
  }
  if (opts.server) cfg.serverUrl = opts.server;
  await runAgent(cfg);
}

// ── wallet ────────────────────────────────────────────────────────────────────

async function cmdWallet(agentId) {
  printBanner();
  if (!walletExists(agentId)) {
    err(`No wallet for "${agentId}". Run ${chalk.bold(`agentx init --agent-id ${agentId}`)} first.`);
    process.exit(1);
  }
  const { address, provider } = await loadOrCreateWallet(agentId);
  section(`Wallet: ${agentId}`);
  console.log(chalk.bold('  Address: ') + chalk.cyan(address));
  try {
    const eth  = await provider.getBalance(address);
    console.log(chalk.bold('  ETH:     ') + chalk.cyan(ethers.formatEther(eth)) + ' ETH');
  } catch (e) {
    err('Could not read ETH balance: ' + e.message);
  }
  const deployed = loadDeployed();
  if (deployed?.goldToken) {
    try {
      const gold = new ethers.Contract(deployed.goldToken, ERC20_BALANCE_ABI, provider);
      const bal  = await gold.balanceOf(address);
      console.log(chalk.bold('  GGLD:    ') + chalk.yellow(ethers.formatEther(bal)) + ' GGLD');
    } catch (e) {
      err('Could not read GGLD balance: ' + e.message);
    }
  } else {
    dim('GGLD: contracts/deployed.json not found — deploy contracts to see balance');
  }
  dim(`keyfile: ${walletPath(agentId)}`);
  dim(`explorer: https://sepolia.basescan.org/address/${address}`);
}

// ── fund ──────────────────────────────────────────────────────────────────────

async function cmdFund(agentId) {
  printBanner();
  if (!walletExists(agentId)) {
    err(`No wallet for "${agentId}". Run ${chalk.bold('agentx init')} first.`);
    process.exit(1);
  }
  const { address, provider } = await loadOrCreateWallet(agentId);
  section(`Fund: ${agentId}`);
  console.log(chalk.bold('  Address: ') + chalk.cyan(address));
  console.log();
  dim('Send Base Sepolia ETH from any faucet:');
  dim('  • https://www.alchemy.com/faucets/base-sepolia');
  dim('  • https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet');
  dim('  • https://faucet.quicknode.com/base/sepolia');
  console.log();
  await waitForFunding(provider, address);
}

// ── shared: poll for ETH balance ──────────────────────────────────────────────

async function waitForFunding(provider, address) {
  info(`Watching ${chalk.cyan(address)} for ETH... ${chalk.gray('(Ctrl+C to stop)')}`);
  let last = 0n;
  while (true) {
    try {
      const bal = await provider.getBalance(address);
      if (bal > 0n) {
        ok(`Received ${chalk.bold(ethers.formatEther(bal))} ETH — wallet funded.`);
        return;
      }
      if (bal !== last) last = bal;
    } catch { /* keep polling */ }
    await new Promise(r => setTimeout(r, 5000));
  }
}

// ── CLI wiring ────────────────────────────────────────────────────────────────

program
  .name('agentx')
  .description('autonomous on-chain agent CLI')
  .version('0.1.0');

program
  .command('init')
  .description('Interactive setup: wallet, persona, provider, server')
  .option('--agent-id <id>',  'Skip the agent name prompt')
  .option('--server <url>',   'Skip the server URL prompt')
  .option('--force',          'Overwrite existing config without asking')
  .action(cmdInit);

program
  .command('run <agent-id>')
  .description('Start an agent using its saved config')
  .option('--server <url>', 'Override saved server URL')
  .action(cmdRun);

program
  .command('wallet <agent-id>')
  .description('Show wallet address and balances')
  .action(cmdWallet);

program
  .command('fund <agent-id>')
  .description('Show funding instructions and watch for ETH arrival')
  .action(cmdFund);

program.parseAsync(process.argv).catch(e => {
  // @inquirer throws when user hits Ctrl+C — exit cleanly
  if (e?.name === 'ExitPromptError') {
    console.log(chalk.gray('\n  cancelled'));
    process.exit(0);
  }
  console.error(chalk.red('\n  error: ') + (e.message ?? e));
  process.exit(1);
});
