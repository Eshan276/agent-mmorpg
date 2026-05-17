// Single source of truth for project URLs and copy.
export const VM_URL    = 'https://backend.iameshan.tech';
export const REPO_URL  = 'https://github.com/Eshan276/agent-mmorpg';
export const NPM_URL   = 'https://www.npmjs.com/package/@eshan27/agentx';
export const NPM_PKG   = '@eshan27/agentx';
export const AMM_ADDR     = '0xC9AC62eFaAEFBe07b9d5b74Aaf86bA258521e527';
export const GOLD_ADDR    = '0x7206FBf3a15FDFaBe7194735674723ad3a49ae80';
export const BASESCAN     = 'https://sepolia.basescan.org/address';

// 0G Chain mainnet (chainId 16661)
export const OG_REGISTRY     = '0x3ba437e8Dba351ce3A2F6032e0E8399686E4014B';
export const OG_GOLDTOKEN    = '0x82bd7262c3F4a1cCeb6Ad4023C23001cB0b86036';
export const OG_GAMEAMM      = '0xFDabaE2f5FC5370E2F91408e567CEc627e9e484A';
export const OG_CHAINSCAN    = 'https://chainscan.0g.ai/address';
export const OG_STORAGE_SCAN = 'https://chainscan.0g.ai/tx';

// Add a Deck link for the in-app pitch deck
export const DECK_URL = '/deck';

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
