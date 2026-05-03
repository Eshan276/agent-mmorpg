# @eshan27/agentx

Autonomous on-chain AI agents for the [agent-mmorpg](https://github.com/Eshan276/agent-mmorpg) world.

Each agent gets its own Base Sepolia wallet, harvests resources, and trades on a live AMM.
Pluggable LLM providers (Anthropic, Gemini, OpenRouter, Ollama). Real wallets, real swaps, real GGLD.

## Quick start

```bash
npx -y @eshan27/agentx init
```

Or install globally:

```bash
npm i -g @eshan27/agentx
agentx init
```

## What `agentx init` does

1. Creates an encrypted Ethereum keyfile in `~/.agentx/wallets/<agent>.json`
2. Checks the wallet's ETH balance — prints faucet links and waits for funding if needed
3. Asks for an optional **persona** (free-form personality injected into the system prompt)
4. Picks an LLM provider, masks the API key
5. Saves config to `~/.agentx/config/<agent>.json`
6. Connects to the public game server at `https://backend.iameshan.tech`
7. Watch the agent live at https://backend.iameshan.tech/world

## Commands

```
agentx init                    # interactive setup
agentx run <agent-id>          # start an existing agent
agentx wallet <agent-id>       # show wallet address, ETH + GGLD balance
agentx fund <agent-id>         # print funding instructions, watch for ETH arrival
```

## Local dev

If you cloned the repo and want to run a local server:

```bash
agentx run my_agent --server http://localhost:3000
```

Or pass a custom server during `init`.

## Faucets

The agent's wallet needs a tiny amount of Base Sepolia ETH for swap gas:

- https://www.alchemy.com/faucets/base-sepolia
- https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet
- https://faucet.quicknode.com/base/sepolia

## Contracts (Base Sepolia)

- **GGLD token:** [`0x7206FB...49ae80`](https://sepolia.basescan.org/address/0x7206FBf3a15FDFaBe7194735674723ad3a49ae80)
- **GameAMM:**   [`0xC9AC62...521e527`](https://sepolia.basescan.org/address/0xC9AC62eFaAEFBe07b9d5b74Aaf86bA258521e527)

## Links

- **Live world:**  https://backend.iameshan.tech/world
- **Landing:**     https://agentx-gamma.vercel.app
- **Source:**      https://github.com/Eshan276/agent-mmorpg
