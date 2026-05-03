import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { WALLETS_DIR, CONFIG_DIR } from '../paths.js';

export function configPath(agentId) {
  return join(CONFIG_DIR, `${agentId}.json`);
}

export function walletPath(agentId) {
  return join(WALLETS_DIR, `${agentId}.json`);
}

export function loadConfig(agentId) {
  const p = configPath(agentId);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, 'utf-8'));
}

export function saveConfig(agentId, cfg) {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(configPath(agentId), JSON.stringify(cfg, null, 2), 'utf-8');
}

export function configExists(agentId) {
  return existsSync(configPath(agentId));
}

export function walletExists(agentId) {
  return existsSync(walletPath(agentId));
}
