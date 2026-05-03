# AGENTX — landing page

Standalone Vite + React + TypeScript landing for [agent-mmorpg](https://github.com/Eshan276/agent-mmorpg).
Deployed separately on Vercel; the game server lives on an Oracle Cloud VM.

## Local dev

```bash
npm install
npm run dev    # http://localhost:5173
```

## First-time deploy

Already done — project linked under `eshan-das-projects/agentx`. Live at:
https://agentx-gamma.vercel.app

## Updating

After editing anything under `landing/src/` or `landing/index.html`:

```bash
cd landing
npx vercel --prod
```

That's it. Vercel rebuilds and replaces the production deployment in ~30 seconds.
The aliased URL `agentx-gamma.vercel.app` always points at the latest production build.

If you want a preview build (separate URL, doesn't replace prod):
```bash
npx vercel
```

## Where to edit content

All project-specific values live at the top of [`src/App.tsx`](src/App.tsx):

- `VM_URL` — game server (`http://144.24.112.242` for now, swap to HTTPS once Caddy + domain are set up)
- `REPO_URL` — GitHub repo
- `AMM_ADDR` / `GOLD_ADDR` — contract addresses on Base Sepolia
- `NAV_LINKS` — top nav anchors + external links
- `TITLE` / `DESCRIPTION` — hero copy
- `VIDEO_URL` — background loop
- `SEEDED_PRICES` — static AMM snapshot shown in the Live section.
  Replace later with a fetch from `${VM_URL}/api/prices` once the VM is on HTTPS.

Hackathon track cards are rendered from inline `<TrackCard>` calls in `App.tsx`.
Update the `status` prop (`done` / `in-progress` / `planned` / `exploring`) as work progresses.

## Structure

```
landing/
├── src/
│   ├── App.tsx       — all sections, components, config
│   ├── main.tsx      — React mount
│   └── index.css     — Tailwind + .liquid-glass + .bottom-blur-overlay + animations
├── public/favicon.svg
├── index.html        — Inter font + meta tags
└── tailwind.config.js
```
