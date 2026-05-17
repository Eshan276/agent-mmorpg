#!/usr/bin/env node
import { program } from 'commander';
import chalk       from 'chalk';
import { input, password, select, confirm } from '@inquirer/prompts';
import { ethers }  from 'ethers';

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

import { printBanner, section, ok, warn, info, err, dim } from './banner.js';
import { configPath, walletPath, loadConfig, saveConfig, configExists, walletExists } from './config.js';
import { loadOrCreateWallet } from '../wallet.js';
import { runAgent }           from './run.js';
import { PACKAGE_ROOT }       from '../paths.js';

// Bundled in the package so the CLI works after `npx @eshan276/agentx`.
// Falls back to the repo path for local development.
const DEPLOYED_CANDIDATES = [
  join(PACKAGE_ROOT, 'deployed.json'),                    // shipped in npm package
  join(PACKAGE_ROOT, '..', 'contracts', 'deployed.json'), // local repo dev
];

function loadDeployed() {
  for (const p of DEPLOYED_CANDIDATES) {
    if (!existsSync(p)) continue;
    try { return JSON.parse(readFileSync(p, 'utf-8')); } catch { /* try next */ }
  }
  return null;
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
  // Heads-up only — when the agent connects to the public AGENTX server, the
  // server auto-drips a small amount of native 0G gas + 100 GGLD to the agent's
  // wallet on register. No manual faucet visit needed for the default flow.
  let ethBalance = 0n;
  try {
    ethBalance = await provider.getBalance(address);
  } catch { /* RPC may be down — non-fatal */ }
  const ethStr = ethers.formatEther(ethBalance);
  if (ethBalance === 0n) {
    info('Wallet has 0 balance — that\'s fine.');
    dim('On register, the public AGENTX server drips ~0.005 native 0G + mints 100 GGLD');
    dim('directly to this wallet on 0G mainnet. No manual faucet needed for the default flow.');
    console.log();
    const wait = await confirm({ message: 'Pause and wait for an external funding tx? (default no — server will drip)', default: false });
    if (wait) await waitForFunding(provider, address);
  } else {
    ok(`Native balance: ${chalk.bold(ethStr)} (sufficient for gas)`);
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
    default: opts.server || 'https://backend.iameshan.tech',
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
    console.log();
    info(`Run later with: ${chalk.bold(`agentx run ${agentId}`)}`);
    dim(`Tip: install globally for shorter commands: npm i -g @eshan27/agentx`);
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
  dim('Heads up: the public AGENTX server auto-drips 0G + GGLD on register.');
  dim('Only need this command if you self-host the server or top up manually.');
  dim('  Mainnet:  acquire 0G via any 0G-supporting exchange/bridge');
  dim('  Testnet:  https://faucet.0g.ai  (Galileo)');
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
  .version('0.2.2');

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
