# Intent Bridge MVP

Fast-flow cross-chain bridge between **Ethereum Sepolia** and **Avalanche Fuji**.
User deposits → Kwala relayer detects event → fills on destination → frontend
shows live status. No settlement layer, no canonical bridge, single trusted relayer.

```
User → BridgeForm → IntentEscrow (Sepolia) ──[IntentCreated]──►
  [Kwala Workflow A] → IntentEscrow (Fuji) ──[IntentFilled]──►
  [Kwala Workflow B] → /api/webhooks/fill → data/intents.json →
  Frontend (3s poll) → IntentStatus
```

## Prerequisites

- Node 20+
- npm (comes with Node)
- [Foundry](https://book.getfoundry.sh/getting-started/installation)
- A wallet with Sepolia ETH and Fuji AVAX (faucet links below)

## Setup

```bash
# 1. Clone and install JS deps
git clone <repo>
cd intent-based-bridge
npm install

# 2. Copy env and fill in values
cp .env.example .env
# Edit .env: add SEPOLIA_RPC_URL, FUJI_RPC_URL, DEPLOYER_PRIVATE_KEY,
#            WEBHOOK_SECRET, and the NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID

# 3. Install Foundry deps and build contracts
cd contracts
make install
make build
cd ..

# 4. Deploy to both testnets (run each, copy output addresses to .env)
cd contracts
make deploy-sepolia
# Copy MOCK_USDC and INTENT_ESCROW from output →
#   NEXT_PUBLIC_MOCK_USDC_SEPOLIA=0x...
#   NEXT_PUBLIC_INTENT_ESCROW_SEPOLIA=0x...

make deploy-fuji
# Copy →
#   NEXT_PUBLIC_MOCK_USDC_FUJI=0x...
#   NEXT_PUBLIC_INTENT_ESCROW_FUJI=0x...
cd ..

# 5. Generate lib/abis.ts from Foundry artifacts
npm run gen-abis

# 6. Start the app (Next.js serves both frontend and API)
npm run dev
```

Open http://localhost:3000.

## Test the fast flow end-to-end (without Kwala)

Before Kwala workflows are configured you can simulate the relayer manually.

**One-time setup** (do this once per destination chain):
```bash
# The deployer wallet needs mUSDC on Fuji and must approve the escrow
# Approve escrow to spend deployer's mUSDC on Fuji:
cast send $NEXT_PUBLIC_MOCK_USDC_FUJI \
  "approve(address,uint256)" \
  $NEXT_PUBLIC_INTENT_ESCROW_FUJI \
  1000000000000000000000000 \
  --rpc-url $FUJI_RPC_URL \
  --private-key $DEPLOYER_PRIVATE_KEY
```

**Fill an intent manually:**
```bash
cd contracts
make manual-fill \
  CHAIN=fuji \
  INTENT_ID=0x<intentId from frontend or logs> \
  ORIGIN_CHAIN_ID=11155111 \
  RECIPIENT=0x<recipient address> \
  OUTPUT_TOKEN=$NEXT_PUBLIC_MOCK_USDC_FUJI \
  OUTPUT_AMOUNT=998000000000000000
```

The frontend will poll and transition to the "filled" state within ~3 seconds after
the Kwala fill-webhook would normally fire. To simulate the webhook too:
```bash
curl -X POST http://localhost:3000/api/webhooks/fill \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: $WEBHOOK_SECRET" \
  -d '{
    "intentId": "0x...",
    "originChainId": 11155111,
    "relayer": "0x...",
    "recipient": "0x...",
    "outputToken": "0x...",
    "outputAmount": "998000000000000000",
    "txHash": "0x...",
    "chainId": 43113
  }'
```

## Faucet links

| Network | ETH / AVAX faucet | mUSDC |
|---|---|---|
| Sepolia | https://sepoliafaucet.com | "Get test mUSDC" button in the app header |
| Fuji | https://faucet.avax.network | "Get test mUSDC" button (switch wallet to Fuji first) |

## Project structure

```
.
├── app/                    Next.js App Router (frontend + API routes)
│   ├── api/                API route handlers (quote, intent, webhooks, cron)
│   └── components/         BridgeForm, ChainSelector, IntentStatus
├── contracts/              Foundry project
│   ├── src/                IntentEscrow.sol, MockUSDC.sol
│   ├── test/               Foundry tests
│   └── script/             Deploy.s.sol
├── lib/                    Shared TS: ABIs, chain config, types, JSON storage
├── scripts/                gen-abis.ts — copies ABI from Foundry out/ to lib/
├── data/                   intents.json written at runtime (gitignored)
├── .env.example            All required environment variables
└── CLAUDE.md               Architecture notes for AI assistants
```

## Scripts cheat sheet

| Command | What it does |
|---|---|
| `npm run dev` | Start Next.js dev server on :3000 |
| `npm run build` | Production build |
| `npm run gen-abis` | Regenerate `lib/abis.ts` from `contracts/out/` |
| `cd contracts && make install` | Fetch Foundry deps (OZ, forge-std) |
| `cd contracts && make build` | Compile contracts |
| `cd contracts && make test` | Run Foundry tests |
| `cd contracts && make deploy-sepolia` | Deploy to Sepolia |
| `cd contracts && make deploy-fuji` | Deploy to Fuji |
| `cd contracts && make manual-fill CHAIN=fuji INTENT_ID=0x... ...` | Manually fill an intent |

## Troubleshooting

**"RPC rate limit" errors in the frontend**
Add `NEXT_PUBLIC_SEPOLIA_RPC_URL` and `NEXT_PUBLIC_FUJI_RPC_URL` in `.env` pointing
to Alchemy or Infura endpoints. The default public RPCs throttle aggressively.

**"Wrong network" banner won't dismiss / wallet stuck on wrong chain**
Click the Switch button in the banner. If MetaMask doesn't prompt, manually switch
in the wallet extension, then reload the page.

**`fillIntent` reverts with "ERC20: insufficient allowance"**
The deployer wallet needs to approve the destination IntentEscrow to spend mUSDC
before running `make manual-fill`. Run the one-time `cast send approve` command
from the "Test the fast flow" section above.
