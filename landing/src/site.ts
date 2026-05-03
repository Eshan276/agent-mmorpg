// Single source of truth for project URLs and copy.
export const VM_URL    = 'https://backend.iameshan.tech';
export const REPO_URL  = 'https://github.com/Eshan276/agent-mmorpg';
export const NPM_URL   = 'https://www.npmjs.com/package/@eshan27/agentx';
export const NPM_PKG   = '@eshan27/agentx';
export const AMM_ADDR  = '0xC9AC62eFaAEFBe07b9d5b74Aaf86bA258521e527';
export const GOLD_ADDR = '0x7206FBf3a15FDFaBe7194735674723ad3a49ae80';
export const BASESCAN  = 'https://sepolia.basescan.org/address';

export const NAV_LINKS: { label: string; href: string; external?: boolean }[] = [
  { label: 'How it works', href: '/#how-it-works' },
  { label: 'Live',         href: '/#live'         },
  { label: 'Stack',        href: '/#stack'        },
  { label: 'Tracks',       href: '/#tracks'       },
  { label: 'Docs',         href: '/docs'          },
  { label: 'Spectate',     href: `${VM_URL}/world`, external: true },
  { label: 'GitHub',       href: REPO_URL,          external: true },
];
