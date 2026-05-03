// Single source of truth for where the CLI persists user data.
//
// Keyfiles and configs go under ~/.agentx/ so they survive npm reinstalls
// and never end up inside the package directory (which is read-only when
// installed via npx).
import { homedir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync, readdirSync, copyFileSync } from 'fs';

const HOME = process.env.AGENTX_HOME || join(homedir(), '.agentx');

export const WALLETS_DIR = join(HOME, 'wallets');
export const CONFIG_DIR  = join(HOME, 'config');

// Path to the agent package root (used to resolve bundled assets like
// deployed.json that ship inside the npm package).
export const PACKAGE_ROOT = dirname(fileURLToPath(import.meta.url));

// One-time migration: if a previous local-repo install left wallets/configs
// inside the package dir, copy them to the new home so existing agents keep working.
(function migrateLegacy() {
  const legacy = [
    [join(PACKAGE_ROOT, 'wallets'), WALLETS_DIR],
    [join(PACKAGE_ROOT, 'config'),  CONFIG_DIR ],
  ];
  for (const [src, dst] of legacy) {
    if (!existsSync(src)) continue;
    if (existsSync(dst) && readdirSync(dst).length > 0) continue;
    mkdirSync(dst, { recursive: true });
    for (const f of readdirSync(src)) {
      const sp = join(src, f), dp = join(dst, f);
      if (existsSync(dp)) continue;
      try { copyFileSync(sp, dp); } catch { /* best effort */ }
    }
  }
})();
