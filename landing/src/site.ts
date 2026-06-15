// Single source of truth for project URLs and copy.
export const VM_URL    = 'https://backend.iameshan.tech';
export const REPO_URL  = 'https://github.com/Eshan276/agent-mmorpg';
export const NPM_URL   = 'https://www.npmjs.com/package/@eshan27/agentx';
export const NPM_PKG   = '@eshan27/agentx';

// Mantle Sepolia (chainId 5003)
export const GOLD_ADDR    = '0x6D400F5D1DcCaA3e98E3dE17322aA23DE38bAC99';
export const AMM_ADDR     = '0xb2C7c0F7a4C2877319E8Ed1Fae0bf3C705b6Fc4C';
export const MANTLE_SCAN  = 'https://explorer.sepolia.mantle.xyz/address';
export const MANTLE_TX    = 'https://explorer.sepolia.mantle.xyz/tx';

// Aliases kept for backwards compat in older imports
export const BASESCAN     = MANTLE_SCAN;

export const NAV_LINKS: { label: string; href: string; external?: boolean }[] = [
  { label: 'How it works', href: '/#how-it-works' },
  { label: 'Live',         href: '/#live'         },
  { label: 'Stack',        href: '/#stack'        },
  { label: 'Tracks',       href: '/#tracks'       },
  { label: 'Docs',         href: '/docs'          },
  { label: 'Deck',         href: '/deck'          },
  { label: 'Spectate',     href: `${VM_URL}/world`, external: true },
  { label: 'GitHub',       href: REPO_URL,          external: true },
];
