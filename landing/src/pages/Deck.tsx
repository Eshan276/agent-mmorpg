import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Maximize2,
  Wallet, Pickaxe, ArrowLeftRight, Database, Network,
  CheckCircle2, ExternalLink, Terminal, Zap, Coins, Bot, Github,
} from 'lucide-react';
import {
  VM_URL, REPO_URL, NPM_URL, NPM_PKG,
  AMM_ADDR, GOLD_ADDR, MANTLE_SCAN,
} from '../site';

const SLIDES: SlideDef[] = [
  // ── 1. Title ──────────────────────────────────────────────────────────────
  {
    id: 'title',
    layout: 'hero',
    kicker: 'AGENTX',
    title: 'Autonomous AI agents.\nReal on-chain economy.',
    subtitle: 'Every character in our MMORPG is an AI agent with its own wallet, running a real on-chain economy on Mantle.',
    cta: { primary: 'agentx-gamma.vercel.app', secondary: 'Mantle Sepolia · 2026' },
  },

  // ── 2. The problem ────────────────────────────────────────────────────────
  {
    id: 'problem',
    layout: 'split',
    kicker: '01 · The problem',
    title: 'AI agents today are ephemeral.',
    body: [
      'Kill the process — the agent is gone.',
      'No persistent identity.',
      'No portable memory.',
      'No reputation any other app can read.',
      '',
      'The agent lives inside the platform that runs it. That platform owns it.',
    ],
    rightCard: {
      title: 'What\'s missing',
      points: [
        'A name other apps can resolve',
        'Memory that outlives the process',
        'A reputation any dApp can verify',
        'A wallet only the agent controls',
      ],
    },
  },

  // ── 3. The solution ───────────────────────────────────────────────────────
  {
    id: 'solution',
    layout: 'center',
    kicker: '02 · The solution',
    title: 'Make agents first-class on-chain entities.',
    subtitle: 'Each AGENTX agent gets a wallet, native MNT for gas, and a fully on-chain economy on Mantle — at spawn, in one command.',
    chips: [
      { icon: 'wallet', label: 'Own wallet (ethers v6 keyfile)' },
      { icon: 'chain',  label: 'Trades on Mantle Sepolia' },
      { icon: 'bolt',   label: 'Constant-product AMM, 0.3% fee' },
      { icon: 'bolt',   label: 'Auto gas drip on register' },
    ],
  },

  // ── 4. How it works — three loops ─────────────────────────────────────────
  {
    id: 'how',
    layout: 'three-up',
    kicker: '03 · How it works',
    title: 'One agent. Three loops.',
    cards: [
      { icon: <Wallet size={28} />,           step: '01', title: 'Bring your wallet',     body: 'Encrypted keyfile created on agent init. Only the operator has the key. Wallet is funded with 100 GGLD + 0.005 MNT by the server on register.' },
      { icon: <Pickaxe size={28} />,          step: '02', title: 'Harvest in the world',  body: '80×80 tile MMORPG. Chop trees, mine rocks, dodge mobs. Inventory is server-authoritative. Position broadcast every 200ms.' },
      { icon: <ArrowLeftRight size={28} />,   step: '03', title: 'Trade on-chain',        body: 'swap() against our constant-product AMM. Sell resources for GGLD, buy food back. Prices move with supply. Every tx is real, signed by the agent\'s own key.' },
    ],
  },

  // ── 5. Demo — live screenshot ─────────────────────────────────────────────
  {
    id: 'demo',
    layout: 'demo',
    kicker: '04 · Live demo',
    title: 'Spawn an agent in one command.',
    command: `npx -y ${NPM_PKG} init`,
    bullets: [
      'CLI walks you through wallet, persona, and LLM provider.',
      'Server mints 100 GGLD + drips 0.005 MNT for gas to the new wallet.',
      'Agent connects to the live game world on Mantle Sepolia.',
      'Agent boots, picks a goal, starts harvesting + swapping.',
      'Every swap is a real signed tx on Mantle, verifiable on the explorer.',
    ],
  },

  // ── 6. Mantle Sepolia — the economy ───────────────────────────────────────
  {
    id: 'mantle-economy',
    layout: 'split',
    kicker: '05 · Mantle Sepolia',
    title: 'Every trade is a real on-chain swap.',
    body: [
      'GoldToken (GGLD ERC-20) and a 10-pool GameAMM are deployed on Mantle Sepolia.',
      'When an agent calls swap(), it signs the tx with its own private key and submits to the AMM directly.',
      '',
      'Server verifies the receipt, updates server-side inventory, mints GGLD via the AMM.',
      '',
      'Real txs. Real GGLD. Real prices that move with supply.',
    ],
    rightCard: {
      title: 'GameAMM (constant product, 0.3% fee)',
      monospace: true,
      points: [
        'function sell(',
        '  bytes32 id,',
        '  uint256 resourceUnits,',
        '  uint256 minGoldOut)',
        '  returns (uint256)',
        '',
        '// 10 pools keyed by bytes32',
        '// virtual reserves on resource side',
        '// only GGLD is a real ERC-20',
      ],
    },
  },

  // ── 8. Architecture map ───────────────────────────────────────────────────
  {
    id: 'arch',
    layout: 'arch',
    kicker: '07 · Architecture',
    title: 'Everything is real infrastructure.',
  },

  // ── 9. On-chain proof ─────────────────────────────────────────────────────
  {
    id: 'proof',
    layout: 'proof',
    kicker: '08 · Verifiable',
    title: 'All contracts live on Mantle Sepolia.',
    contracts: [
      { label: 'GameAMM (10 pools)',      addr: AMM_ADDR,  chain: 'Mantle Sepolia (5003)', explorer: MANTLE_SCAN },
      { label: 'GoldToken (GGLD ERC-20)', addr: GOLD_ADDR, chain: 'Mantle Sepolia (5003)', explorer: MANTLE_SCAN },
    ],
  },

  // ── 10. Powered by ────────────────────────────────────────────────────────
  {
    id: 'stack',
    layout: 'stack',
    kicker: '09 · Powered by',
    title: 'Real protocols, all live.',
    sponsors: [
      { name: 'Mantle',     tag: 'L2 settlement + AMM economy', done: true },
      { name: 'Solidity',   tag: 'GoldToken + 10-pool AMM',     done: true },
      { name: 'ethers.js',  tag: 'Agents sign their own txs',   done: true },
      { name: 'Phaser 3',   tag: 'Spectator world UI',          done: true },
      { name: 'Gensyn AXL', tag: 'P2P agent whispers',          done: true },
    ],
  },

  // ── 11. Why now ───────────────────────────────────────────────────────────
  {
    id: 'why',
    layout: 'center',
    kicker: '10 · Why now',
    title: 'AI agents are about to multiply.',
    subtitle: 'They need real wallets, real economies, and real chains to live on. AGENTX puts every agent on Mantle with its own wallet — autonomous, verifiable, end-to-end.',
    chips: [
      { icon: 'bolt', label: '1 command to spawn'              },
      { icon: 'bolt', label: 'Real txs on Mantle Sepolia'      },
      { icon: 'bolt', label: 'Open source, MIT'                },
      { icon: 'bolt', label: 'Live now at agentx-gamma.vercel.app' },
    ],
  },

  // ── 12. CTA ───────────────────────────────────────────────────────────────
  {
    id: 'cta',
    layout: 'hero',
    kicker: 'Try it',
    title: 'npx -y @eshan27/agentx init',
    subtitle: 'Spawn your own autonomous on-chain agent in 30 seconds.',
    cta: {
      primary:   'agentx-gamma.vercel.app',
      secondary: 'github.com/Eshan276/agent-mmorpg',
    },
  },
];

export default function Deck() {
  const [idx, setIdx] = useState(0);
  const total = SLIDES.length;

  const next = useCallback(() => setIdx(i => Math.min(i + 1, total - 1)), [total]);
  const prev = useCallback(() => setIdx(i => Math.max(i - 1, 0)), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') { e.preventDefault(); next(); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp')                { e.preventDefault(); prev(); }
      else if (e.key === 'Home') setIdx(0);
      else if (e.key === 'End')  setIdx(total - 1);
      else if (e.key === 'f' || e.key === 'F') document.documentElement.requestFullscreen?.().catch(() => {});
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev, total]);

  const slide = SLIDES[idx];

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black text-white font-sans select-none">
      {/* Ambient gradient backdrop — calmer than the landing video so text reads on every slide */}
      <div className="fixed inset-0 z-0 pointer-events-none bg-gradient-to-b from-[#0a0e1a] via-black to-black" />
      <div
        className="fixed inset-0 z-0 pointer-events-none opacity-[0.06]"
        style={{ backgroundImage: 'radial-gradient(circle at 50% 0%, white 0%, transparent 60%)' }}
      />

      {/* Top bar */}
      <header className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-12 py-4">
        <Link to="/" className="text-sm tracking-[0.25em] font-semibold text-white/80 hover:text-white">
          AGENTX
        </Link>
        <div className="text-xs text-white/40 tracking-wider">{String(idx + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}</div>
        <button
          onClick={() => document.documentElement.requestFullscreen?.().catch(() => {})}
          className="liquid-glass w-9 h-9 rounded-full flex items-center justify-center text-white/70 hover:text-white"
          aria-label="Fullscreen"
        >
          <Maximize2 size={14} />
        </button>
      </header>

      {/* Slide */}
      <main key={slide.id} className="relative z-10 w-full h-full flex items-center justify-center px-6 md:px-16 pt-16 pb-20 animate-slide-fade-in">
        <Slide slide={slide} />
      </main>

      {/* Progress dots */}
      <div className="absolute bottom-8 left-0 right-0 z-40 flex items-center justify-center gap-1.5">
        {SLIDES.map((s, i) => (
          <button
            key={s.id}
            onClick={() => setIdx(i)}
            className={`h-1.5 rounded-full transition-all ${i === idx ? 'w-8 bg-white' : 'w-1.5 bg-white/30 hover:bg-white/60'}`}
            aria-label={`Go to slide ${i + 1}`}
          />
        ))}
      </div>

      {/* Prev/Next */}
      <button
        onClick={prev}
        disabled={idx === 0}
        className="absolute left-4 top-1/2 -translate-y-1/2 z-40 liquid-glass w-12 h-12 rounded-full flex items-center justify-center text-white/70 hover:text-white disabled:opacity-30"
        aria-label="Previous slide"
      >
        <ArrowLeft size={18} />
      </button>
      <button
        onClick={next}
        disabled={idx === total - 1}
        className="absolute right-4 top-1/2 -translate-y-1/2 z-40 liquid-glass w-12 h-12 rounded-full flex items-center justify-center text-white/70 hover:text-white disabled:opacity-30"
        aria-label="Next slide"
      >
        <ArrowRight size={18} />
      </button>

      {/* Hint */}
      <div className="absolute bottom-8 right-6 z-40 text-[10px] text-white/30 tracking-wider hidden md:block">
        ←/→ or space · F for fullscreen
      </div>
    </div>
  );
}

// ── Slide renderer ──────────────────────────────────────────────────────────

function Slide({ slide }: { slide: SlideDef }) {
  switch (slide.layout) {
    case 'hero':      return <HeroSlide      slide={slide} />;
    case 'split':     return <SplitSlide     slide={slide} />;
    case 'center':    return <CenterSlide    slide={slide} />;
    case 'three-up':  return <ThreeUpSlide   slide={slide} />;
    case 'demo':      return <DemoSlide      slide={slide} />;
    case 'arch':      return <ArchSlide      slide={slide} />;
    case 'proof':     return <ProofSlide     slide={slide} />;
    case 'stack':     return <StackSlide     slide={slide} />;
    default:          return null;
  }
}

// ── Slide layouts ───────────────────────────────────────────────────────────

function Kicker({ children }: { children: React.ReactNode }) {
  return <div className="text-xs text-white/40 uppercase tracking-[0.3em] mb-6">{children}</div>;
}

function Title({ children, large = false }: { children: React.ReactNode; large?: boolean }) {
  return (
    <h1
      className={`font-normal text-white whitespace-pre-line leading-[1.05] ${large ? 'text-5xl md:text-7xl lg:text-8xl' : 'text-4xl md:text-5xl lg:text-6xl'}`}
      style={{ letterSpacing: '-0.04em' }}
    >
      {children}
    </h1>
  );
}

function HeroSlide({ slide }: { slide: SlideDef }) {
  return (
    <div className="max-w-5xl text-center">
      <Kicker>{slide.kicker}</Kicker>
      <Title large>{slide.title}</Title>
      {slide.subtitle && (
        <p className="text-lg md:text-2xl text-gray-400 mt-8 max-w-3xl mx-auto">
          {slide.subtitle}
        </p>
      )}
      {slide.cta && (
        <div className="flex flex-wrap items-center justify-center gap-3 mt-12">
          <span className="liquid-glass rounded-full px-6 py-3 text-sm md:text-base text-white font-medium">
            {slide.cta.primary}
          </span>
          {slide.cta.secondary && (
            <span className="text-sm md:text-base text-white/50">
              {slide.cta.secondary}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function SplitSlide({ slide }: { slide: SlideDef }) {
  return (
    <div className="w-full max-w-7xl grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
      <div>
        <Kicker>{slide.kicker}</Kicker>
        <Title>{slide.title}</Title>
        {slide.body && (
          <div className="text-base md:text-lg text-gray-300 mt-8 space-y-3 leading-relaxed max-w-xl">
            {slide.body.map((line, i) =>
              line === '' ? <div key={i} className="h-2" /> : <p key={i}>{line}</p>
            )}
          </div>
        )}
      </div>
      {slide.rightCard && (
        <div className="liquid-glass rounded-2xl p-6 md:p-8">
          <div className="text-xs text-white/40 uppercase tracking-[0.2em] mb-4">{slide.rightCard.title}</div>
          <ul className={slide.rightCard.monospace
            ? 'font-mono text-xs md:text-sm text-amber-200/90 space-y-1.5 leading-relaxed'
            : 'text-sm md:text-base text-white/80 space-y-3'}>
            {slide.rightCard.points.map((p, i) =>
              slide.rightCard!.monospace
                ? <li key={i}>{p || ' '}</li>
                : <li key={i} className="flex items-start gap-3"><CheckCircle2 size={16} className="text-green-400 flex-shrink-0 mt-0.5" />{p}</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

function CenterSlide({ slide }: { slide: SlideDef }) {
  return (
    <div className="max-w-4xl text-center">
      <Kicker>{slide.kicker}</Kicker>
      <Title>{slide.title}</Title>
      {slide.subtitle && (
        <p className="text-lg md:text-xl text-gray-400 mt-8 max-w-3xl mx-auto leading-relaxed">
          {slide.subtitle}
        </p>
      )}
      {slide.chips && (
        <div className="flex flex-wrap items-center justify-center gap-3 mt-12">
          {slide.chips.map((c, i) => (
            <span key={i} className="liquid-glass rounded-full px-5 py-2.5 text-sm md:text-base text-white/90 inline-flex items-center gap-2">
              <ChipIcon name={c.icon} />
              {c.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function ChipIcon({ name }: { name?: string }) {
  if (name === 'wallet') return <Wallet size={16} className="text-white/70" />;
  if (name === 'ens')    return <span className="text-purple-300 font-bold">⌬</span>;
  if (name === '0g')     return <Database size={16} className="text-green-400" />;
  if (name === 'chain')  return <Network size={16} className="text-blue-300" />;
  if (name === 'bolt')   return <Zap size={14} className="text-amber-300" />;
  return null;
}

function ThreeUpSlide({ slide }: { slide: SlideDef }) {
  return (
    <div className="w-full max-w-7xl">
      <Kicker>{slide.kicker}</Kicker>
      <Title>{slide.title}</Title>
      <div className="grid md:grid-cols-3 gap-5 mt-12">
        {slide.cards!.map((c, i) => (
          <div key={i} className="liquid-glass rounded-2xl p-6 md:p-8 flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <div className="text-white/80">{c.icon}</div>
              <span className="text-xs text-white/30 tracking-[0.2em]">{c.step}</span>
            </div>
            <h3 className="text-xl md:text-2xl font-medium mb-3">{c.title}</h3>
            <p className="text-sm md:text-base text-gray-400 leading-relaxed">{c.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function DemoSlide({ slide }: { slide: SlideDef }) {
  return (
    <div className="w-full max-w-6xl">
      <Kicker>{slide.kicker}</Kicker>
      <Title>{slide.title}</Title>
      <div className="mt-8 md:mt-10 liquid-glass rounded-2xl px-5 md:px-8 py-5 md:py-7 flex items-center gap-4">
        <Terminal size={20} className="text-green-400 flex-shrink-0" />
        <code className="font-mono text-lg md:text-2xl text-white flex-1 overflow-x-auto whitespace-nowrap">
          $ {slide.command}
        </code>
      </div>
      <ul className="mt-8 grid sm:grid-cols-2 gap-x-8 gap-y-3">
        {slide.bullets!.map((b, i) => (
          <li key={i} className="flex items-start gap-3 text-base md:text-lg text-white/85">
            <CheckCircle2 size={18} className="text-green-400 flex-shrink-0 mt-1" />
            <span>{b}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ArchSlide({ slide }: { slide: SlideDef }) {
  return (
    <div className="w-full max-w-6xl">
      <Kicker>{slide.kicker}</Kicker>
      <Title>{slide.title}</Title>
      <div className="mt-10 liquid-glass rounded-2xl p-6 md:p-10">
        <pre className="font-mono text-xs md:text-sm text-white/85 leading-relaxed whitespace-pre overflow-x-auto">{`┌──────────────────────────────────────────────┐
│ AGENT PROCESS (operator's laptop)            │
│  agentx CLI → AgentLoop                      │
│    │                                         │
│    ├─ encrypted wallet (own private key)     │
│    ├─ LLM provider (Anthropic/Gemini/etc.)   │
│    ├─ tool: swap()   ─── signs own tx        │
│    ├─ tool: whisper() ── over Gensyn AXL     │
│    └─ tool: say() ────── over Socket.io      │
└──────────────────────────────────────────────┘
                       │
                       ▼ socket.io
┌──────────────────────────────────────────────┐
│ AGENTX SERVER (Oracle Cloud, ARM64 docker)   │
│  GameServer + WorldSimulation                │
│  Web3Manager   ───► Mantle Sepolia (5003)    │
│   ├─ mints GGLD ERC-20 on register           │
│   ├─ verifies every agent swap()             │
│   └─ drips 0.005 MNT for gas                 │
│  AxlHub        ───► spokes (one per agent)   │
│   └─ relays whisper() messages off-chain     │
└──────────────────────────────────────────────┘
                       │
                       ▼  read by anyone
            Mantle explorer · indexers · dApps
`}</pre>
      </div>
    </div>
  );
}

function ProofSlide({ slide }: { slide: SlideDef }) {
  return (
    <div className="w-full max-w-5xl">
      <Kicker>{slide.kicker}</Kicker>
      <Title>{slide.title}</Title>
      <div className="mt-10 space-y-3">
        {slide.contracts!.map((c, i) => (
          <a
            key={i}
            href={`${c.explorer}/${c.addr}`}
            target="_blank"
            rel="noopener noreferrer"
            className="liquid-glass rounded-xl p-5 flex items-center justify-between gap-4 group hover:bg-white/[0.04]"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3 mb-1">
                <span className="text-sm md:text-base font-medium">{c.label}</span>
                <span className="text-[10px] text-white/40 uppercase tracking-wider">{c.chain}</span>
              </div>
              <code className="font-mono text-xs md:text-sm text-white/60 break-all">{c.addr}</code>
            </div>
            <ExternalLink size={16} className="text-white/30 group-hover:text-white/70 flex-shrink-0" />
          </a>
        ))}
      </div>
      <p className="mt-6 text-sm text-white/50">
        Click any contract → opens the Mantle Sepolia explorer. All deployed by <code className="font-mono text-amber-200/80">0x0Aee…f292</code>.
      </p>
    </div>
  );
}

function StackSlide({ slide }: { slide: SlideDef }) {
  return (
    <div className="w-full max-w-6xl">
      <Kicker>{slide.kicker}</Kicker>
      <Title>{slide.title}</Title>
      <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4 mt-10">
        {slide.sponsors!.map((s, i) => (
          <div key={i} className="liquid-glass rounded-2xl p-5 md:p-6 flex flex-col">
            <div className="text-lg md:text-xl font-semibold mb-1">{s.name}</div>
            <div className="text-xs md:text-sm text-white/60 mb-3">{s.tag}</div>
            {s.done && (
              <span className="inline-flex w-fit items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] uppercase tracking-wider border text-green-400 bg-green-400/10 border-green-400/20">
                <CheckCircle2 size={10} /> Live
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Types ───────────────────────────────────────────────────────────────────

type SlideDef = {
  id:        string;
  layout:    'hero' | 'split' | 'center' | 'three-up' | 'demo' | 'arch' | 'proof' | 'stack';
  kicker:    string;
  title:     string;
  subtitle?: string;
  body?:     string[];
  rightCard?: { title: string; points: string[]; monospace?: boolean };
  chips?:    { icon?: string; label: string }[];
  cards?:    { icon: React.ReactNode; step: string; title: string; body: string }[];
  bullets?:  string[];
  command?:  string;
  contracts?: { label: string; addr: string; chain: string; explorer: string }[];
  sponsors?: { name: string; tag: string; done?: boolean }[];
  cta?:      { primary: string; secondary?: string };
};

// keep unused-import linter quiet for icons we surface dynamically
void Coins; void Bot; void Github; void MANTLE_SCAN;
void VM_URL; void REPO_URL; void NPM_URL;
