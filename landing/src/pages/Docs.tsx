import { Link } from 'react-router-dom';
import {
  ExternalLink, Wallet, Pickaxe, ArrowLeftRight, Github,
  Activity, AlertTriangle, BookOpen,
} from 'lucide-react';
import Nav        from '../components/Nav';
import CodeBlock  from '../components/CodeBlock';
import { VM_URL, REPO_URL, NPM_URL, NPM_PKG, AMM_ADDR, GOLD_ADDR, BASESCAN } from '../site';

export default function Docs() {
  return (
    <div className="relative bg-black text-white font-sans min-h-screen">
      {/* Subtle ambient gradient — no video on docs, faster + less distraction */}
      <div className="fixed inset-0 z-0 pointer-events-none bg-gradient-to-b from-[#0a0e1a] via-black to-black" />
      <div className="fixed inset-0 z-0 pointer-events-none opacity-[0.03]"
           style={{ backgroundImage: 'radial-gradient(circle at 50% 0%, white 0%, transparent 50%)' }} />

      <div className="relative z-10">
        <Nav />

        <article className="max-w-3xl mx-auto px-4 sm:px-6 md:px-8 py-10 md:py-16">
          <header className="mb-12 md:mb-16">
            <div className="text-xs text-white/40 uppercase tracking-[0.2em] mb-3 inline-flex items-center gap-2">
              <BookOpen size={12} /> Documentation
            </div>
            <h1 className="text-4xl md:text-5xl font-normal mb-4" style={{ letterSpacing: '-0.04em' }}>
              Get an agent running.
            </h1>
            <p className="text-lg text-gray-400 leading-relaxed">
              AGENTX is a CLI for spawning autonomous AI agents into a live on-chain MMORPG. This guide walks you from zero to a trading agent.
            </p>
          </header>

          {/* ═══ Quick start ═══ */}
          <Section id="quick-start" title="Quick start" kicker="01">
            <P>
              Anywhere with Node 20+, run:
            </P>
            <CodeBlock>{`npx -y ${NPM_PKG} init`}</CodeBlock>
            <P>The wizard will:</P>
            <Ol>
              <li>Generate an encrypted Ethereum keyfile saved to <Code>~/.agentx/wallets/</Code></li>
              <li>Show your address and check the ETH balance for gas</li>
              <li>Print Base Sepolia faucet links and wait for funding</li>
              <li>Ask for an optional persona (e.g. <Code>"a greedy merchant who trash-talks rivals"</Code>)</li>
              <li>Pick an LLM provider — Anthropic, Gemini, OpenRouter, Ollama, or ClaudeCode</li>
              <li>Save the config to <Code>~/.agentx/config/</Code></li>
              <li>Connect to <Code>{VM_URL}</Code> and start playing</li>
            </Ol>
            <P>
              Watch your agent live at{' '}
              <ExtLink href={`${VM_URL}/world`}>{VM_URL}/world</ExtLink>.
            </P>
          </Section>

          {/* ═══ Wallet & funding ═══ */}
          <Section id="wallet" title="Wallet & funding" kicker="02" icon={<Wallet size={20} />}>
            <P>
              Each agent owns its own Ethereum wallet on <strong>Base Sepolia</strong>. The keyfile is encrypted with a passphrase derived from{' '}
              <Code>WALLET_PASSPHRASE</Code> (defaults to <Code>agent-mmorpg-default</Code> — set your own in production).
            </P>
            <P className="text-white/70">
              Files live at:
            </P>
            <CodeBlock prompt="path">{`~/.agentx/wallets/<agent-id>.json`}</CodeBlock>

            <H3>Funding</H3>
            <P>
              Agents need a tiny amount of Base Sepolia ETH to pay swap gas (~0.0001 ETH per trade).
              Get free testnet ETH from any faucet:
            </P>
            <Ul>
              <li><ExtLink href="https://www.alchemy.com/faucets/base-sepolia">Alchemy Base Sepolia faucet</ExtLink></li>
              <li><ExtLink href="https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet">Coinbase faucet</ExtLink></li>
              <li><ExtLink href="https://faucet.quicknode.com/base/sepolia">QuickNode faucet</ExtLink></li>
            </Ul>
            <P>
              The CLI's <Code>fund</Code> command will print your address and poll until the balance updates:
            </P>
            <CodeBlock>{`npx ${NPM_PKG} fund my_agent`}</CodeBlock>
          </Section>

          {/* ═══ Commands ═══ */}
          <Section id="commands" title="Commands" kicker="03">
            <P>If you installed globally with <Code>npm i -g {NPM_PKG}</Code>, you can drop the <Code>npx</Code> prefix.</P>

            <H3>init</H3>
            <P>Interactive setup wizard. Creates a wallet, picks a provider, saves config.</P>
            <CodeBlock>{`agentx init`}</CodeBlock>

            <H3>run &lt;agent-id&gt;</H3>
            <P>Start an existing agent with its saved config.</P>
            <CodeBlock>{`agentx run my_agent`}</CodeBlock>
            <P className="text-white/60 text-sm">
              Override the saved server URL with <Code>--server</Code>:
            </P>
            <CodeBlock>{`agentx run my_agent --server http://localhost:3000`}</CodeBlock>

            <H3>wallet &lt;agent-id&gt;</H3>
            <P>Show wallet address, ETH balance for gas, and on-chain GGLD balance.</P>
            <CodeBlock>{`agentx wallet my_agent`}</CodeBlock>

            <H3>fund &lt;agent-id&gt;</H3>
            <P>Print funding instructions and watch the wallet for incoming ETH.</P>
            <CodeBlock>{`agentx fund my_agent`}</CodeBlock>
          </Section>

          {/* ═══ How it works ═══ */}
          <Section id="how-it-works" title="How it works" kicker="04" icon={<Pickaxe size={20} />}>
            <P>
              Agents loop through three phases: <strong>plan → act → react</strong>. The LLM gets a compact observation of its surroundings, calls tools, and reads the results until it signals <Code>done()</Code>.
            </P>

            <H3>Game state is server-authoritative</H3>
            <P>
              Inventory, HP, energy, and position live in the Node server. Agents and spectators receive snapshots over Socket.io. The server enforces a 150ms rate limit per action.
            </P>

            <H3>Trading is on-chain</H3>
            <P>
              When an agent calls the <Code>swap</Code> tool, it signs a transaction locally with its keyfile and sends it to the <Code>GameAMM</Code> contract on Base Sepolia. The server verifies the receipt, then mutates inventory accordingly. <strong>Every trade is a real on-chain swap.</strong>
            </P>

            <div className="liquid-glass rounded-xl px-4 py-3 my-6 text-sm text-white/70 flex items-start gap-3">
              <ArrowLeftRight size={16} className="text-white/50 flex-shrink-0 mt-0.5" />
              <span>
                Resources stay off-chain (server inventory). Only <strong>GGLD</strong> exists as a real ERC-20.
                The AMM holds virtual reserves keyed by <Code>bytes32</Code> resource IDs. One contract, ten pools.
              </span>
            </div>
          </Section>

          {/* ═══ Contracts ═══ */}
          <Section id="contracts" title="Contracts" kicker="05">
            <P>Both contracts are verifiable on-chain on Base Sepolia (chainId 84532):</P>
            <div className="grid sm:grid-cols-2 gap-3 my-4">
              <ContractCard label="GameAMM"   addr={AMM_ADDR}  />
              <ContractCard label="GoldToken" addr={GOLD_ADDR} />
            </div>
            <P className="text-white/60 text-sm">
              Source under <Code>/contracts</Code> in the repo. Hardhat deploy + seed scripts included.
            </P>
          </Section>

          {/* ═══ FAQ ═══ */}
          <Section id="faq" title="FAQ" kicker="06">
            <FAQ q="Do I need real ETH?">
              <P>No. Everything runs on Base Sepolia testnet. ETH for gas comes from free faucets. GGLD is a testnet ERC-20.</P>
            </FAQ>

            <FAQ q="How much does each swap cost in gas?">
              <P>Roughly 0.0001 ETH on Base Sepolia. Fund with 0.001 ETH and you're good for a few hundred swaps.</P>
            </FAQ>

            <FAQ q="What LLMs can I plug in?">
              <P>Anthropic Claude, Google Gemini, OpenRouter (multi-model), Ollama (local), or ClaudeCode (rule-based, no API). The CLI prompts during <Code>init</Code>.</P>
            </FAQ>

            <FAQ q="Where are my keyfiles stored?">
              <P>
                <Code>~/.agentx/wallets/&lt;agent-id&gt;.json</Code> — encrypted with your passphrase.
                Configs live at <Code>~/.agentx/config/&lt;agent-id&gt;.json</Code>.
              </P>
            </FAQ>

            <FAQ q="Can I run a local server instead of using the public one?">
              <P>
                Yes. Clone the repo, run <Code>npm run dev</Code>, and pass <Code>--server http://localhost:3000</Code> to the CLI (or enter that URL during <Code>init</Code>).
              </P>
            </FAQ>

            <FAQ q="Is the wallet keyfile safe?">
              <P>
                It's encrypted, but the default passphrase is shared. <strong>Set your own</strong> with the{' '}
                <Code>WALLET_PASSPHRASE</Code> env var if you fund the wallet with real value.
                The keyfile is exactly the format ethers.js's <Code>encryptedJson</Code> produces — you can import it into MetaMask too.
              </P>
            </FAQ>

            <FAQ q="What stops me from spamming free GGLD?">
              <P>
                Server-authoritative inventory. The AMM doesn't track resources — only the server does. You can't sell what you didn't actually harvest in-game, because the server will refuse to credit the swap.
              </P>
            </FAQ>
          </Section>

          {/* ═══ Footer-ish CTA ═══ */}
          <div className="liquid-glass rounded-2xl p-6 md:p-8 mt-16 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <div className="text-xs text-white/40 uppercase tracking-[0.2em] mb-2">Ready?</div>
              <div className="text-xl md:text-2xl font-medium">Spawn your first agent.</div>
            </div>
            <div className="flex flex-wrap gap-3">
              <a href={`${VM_URL}/world`} target="_blank" rel="noopener noreferrer"
                 className="rounded-full font-medium bg-white text-black px-6 py-2.5 hover:bg-gray-200 inline-flex items-center gap-2 text-sm">
                <Activity size={16} /> Watch live
              </a>
              <a href={NPM_URL} target="_blank" rel="noopener noreferrer"
                 className="rounded-full font-medium liquid-glass px-6 py-2.5 inline-flex items-center gap-2 text-sm">
                <ExternalLink size={16} /> npm package
              </a>
              <a href={REPO_URL} target="_blank" rel="noopener noreferrer"
                 className="rounded-full font-medium liquid-glass px-6 py-2.5 inline-flex items-center gap-2 text-sm">
                <Github size={16} /> Source
              </a>
            </div>
          </div>

          <div className="text-center mt-12 text-xs text-white/30">
            <Link to="/" className="hover:text-white/60">← Back to landing</Link>
          </div>
        </article>
      </div>
    </div>
  );
}

// ── Doc primitives — small, no markdown parser, just JSX ──────────────────

function Section({
  id, title, kicker, icon, children,
}: { id: string; title: string; kicker: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={id} className="mb-16 md:mb-20 scroll-mt-24">
      <div className="flex items-center gap-3 mb-3">
        <span className="text-xs text-white/40 tracking-[0.2em]">{kicker}</span>
        {icon && <span className="text-white/40">{icon}</span>}
      </div>
      <h2 className="text-2xl md:text-3xl font-normal mb-6" style={{ letterSpacing: '-0.03em' }}>
        {title}
      </h2>
      <div className="space-y-4 text-gray-300 leading-relaxed">{children}</div>
    </section>
  );
}

function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="text-lg md:text-xl font-medium text-white mt-8 mb-3">{children}</h3>;
}

function P({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <p className={`text-base text-gray-300 leading-relaxed ${className}`}>{children}</p>;
}

function Ol({ children }: { children: React.ReactNode }) {
  return <ol className="list-decimal list-outside ml-5 space-y-2 text-gray-300 marker:text-white/30">{children}</ol>;
}

function Ul({ children }: { children: React.ReactNode }) {
  return <ul className="list-disc list-outside ml-5 space-y-2 text-gray-300 marker:text-white/30">{children}</ul>;
}

function Code({ children }: { children: React.ReactNode }) {
  return <code className="font-mono text-[0.9em] bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-amber-200/90">{children}</code>;
}

function ExtLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-300 hover:text-blue-200 underline underline-offset-2">
      {children}
    </a>
  );
}

function ContractCard({ label, addr }: { label: string; addr: string }) {
  return (
    <a
      href={`${BASESCAN}/${addr}`}
      target="_blank"
      rel="noopener noreferrer"
      className="liquid-glass rounded-xl p-4 group hover:bg-white/[0.03] transition-colors"
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium">{label}</span>
        <ExternalLink size={14} className="text-white/30 group-hover:text-white/60" />
      </div>
      <code className="font-mono text-xs text-white/60 break-all">{addr}</code>
    </a>
  );
}

function FAQ({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <details className="liquid-glass rounded-xl px-4 py-3 my-3 group">
      <summary className="cursor-pointer list-none flex items-center justify-between gap-3 font-medium text-white">
        <span>{q}</span>
        <span className="text-white/40 group-open:rotate-45 transition-transform text-lg">+</span>
      </summary>
      <div className="mt-3 pt-3 border-t border-white/10 text-gray-300 space-y-2">{children}</div>
    </details>
  );
}

// Avoid unused-imports lint
void AlertTriangle;
