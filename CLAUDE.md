# CLAUDE.md — Intent Bridge

## Project purpose

This is the **fast-flow-only MVP** of an intent-based cross-chain bridge between
Ethereum Sepolia (11155111) and Avalanche Fuji (43113). A user deposits an ERC20
on the origin chain; a trusted relayer (driven by Kwala workflows) detects the
deposit event and fills the intent on the destination chain from its own inventory.
There is deliberately **no settlement layer**, no canonical bridge integration, and
no relayer competition. The relayer eats inventory imbalance. This is a known and
acceptable trade-off for the MVP.

## Architecture

```
User wallet
    │
    │  approve + createIntent(...)
    ▼
IntentEscrow (Sepolia)
    │  emits IntentCreated(intentId, user, inputToken, inputAmount,
    │                       dstChainId, outputToken, outputAmount,
    │                       recipient, fillDeadline, nonce)
    │
    ▼
[Kwala Workflow A — external YAML]
    │  watches IntentCreated on Sepolia
    │  calls fillIntent(intentId, originChainId, recipient,
    │                   outputToken, outputAmount) on Fuji
    ▼
IntentEscrow (Fuji)
    │  emits IntentFilled(intentId, originChainId, relayer,
    │                     recipient, outputToken, outputAmount)
    │
    ▼
[Kwala Workflow B — external YAML]
    │  watches IntentFilled on Fuji
    │  POSTs to /api/webhooks/fill
    ▼
Next.js API route (/api/webhooks/fill)
    │  updates data/intents.json → status: "filled"
    |  (TODO later: emits IntentFilled on source chain (Sepolia) too to maintain cross-chain composability)
    │
    ▼
Frontend (polls GET /api/intent/:id every 3 s)
    └─ IntentStatus component transitions to "filled" state
```

## The five pieces

| Piece | Where | What it does |
|---|---|---|
| **IntentEscrow.sol** | `contracts/src/` | Deployed identically on both chains. Origin: escrows user funds, emits `IntentCreated`. Destination: fills from relayer inventory, emits `IntentFilled`. |
| **Kwala Workflow A** (relayer) | external YAML | Triggers on `IntentCreated`. Calls `fillIntent` on the destination chain. Relayer wallet must hold output tokens and have pre-approved the escrow. |
| **Kwala Workflow B** (notifier) | external YAML | Triggers on `IntentFilled`. POSTs the event data to `/api/webhooks/fill` with the `X-Webhook-Secret` header. |
| **Next.js API routes** | `app/api/` | Quote, intent registration, webhook receiver, expiry cron endpoint. State stored in `data/intents.json`. |
| **Next.js frontend** | `app/` | BridgeForm (approve + createIntent), IntentStatus (polls for updates), ChainSelector. |

## What is intentionally missing

- **Settlement / proof layer** — there is no mechanism to prove on the origin chain
  that an intent was filled on the destination. Reclaim is purely deadline-gated.
- **Canonical bridge integration** — no CCIP, Hyperlane, or native bridge.
- **Real pricing / quoter** — flat 20 bps fee hardcoded in `/api/quote`.
- **Partial fills** — one intent = one fill.
- **Multi-token decimal handling** — both tokens assumed 18 decimals.
- **Relayer competition** — single trusted relayer; no auction or race.

## Trust assumptions in the MVP

1. The relayer is a single trusted entity (you). Anyone who can call `fillIntent`
   can steal the fee by front-running, but there's no incentive to fill *wrong*.
2. `ownerWithdraw` on the escrow is a centralisation risk — the deployer can drain
   the contract. This is the only recovery path for escrowed funds whose intents
   were filled (since there's no settlement). Remove or timelock post-MVP.
3. A user can reclaim after deadline even if the intent was filled on the destination
   (the origin has no cross-chain knowledge). This is the "missing settlement tax".

## The Kwala layer

The YAML workflows live outside this repo. High-level description:

**Workflow A (relayer)**
- Trigger: `IntentCreated` event on Sepolia / Fuji.
- Action: Call `fillIntent(intentId, originChainId, recipient, outputToken, outputAmount)`
  on the destination-chain IntentEscrow using the relayer SmartWallet.
- All parameters are available directly from the event (no extra RPC reads needed).

**Workflow B (notifier)**
- Trigger: `IntentFilled` event on Sepolia / Fuji.
- Action: HTTP POST to `$NEXT_PUBLIC_BACKEND_URL/api/webhooks/fill`.
- Body fields map 1:1 to event params plus `txHash` and `chainId` from tx context.

**Expiry cron**
- Trigger: Kwala schedule (e.g. every 30 s).
- Action: HTTP POST to `/api/cron/expire` (no auth header — Kwala cannot send custom headers).

## Where to look first when extending

Data flows: `IntentEscrow.sol` → `app/api/webhooks/fill/route.ts` → `lib/storage.ts`
→ `app/components/IntentStatus.tsx` (polling `GET /api/intent/:id`).

- Adding a new event field: update the Solidity event, re-run `npm run gen-abis`,
  update `WebhookFillPayload` in `lib/types.ts`, update the webhook route.
- Adding a new chain: add to `lib/chains.ts` + `lib/wagmi.ts`, deploy contracts,
  add env vars, update `SUPPORTED_CHAIN_IDS` in `app/api/quote/route.ts`.

## Common gotchas

1. **Chain ID mismatch** — `intentId` is computed with `block.chainid`. If the
   frontend computes it off-chain it must use the same chain ID. Currently we read
   it from the emitted event (safe), not recompute it.
2. **Decimal assumption** — all amounts are treated as 18-decimal. mUSDC is 18
   decimals (not 6). If you add a real USDC, the quote math breaks.
3. **Allowance race** — `BridgeForm` reads allowance before broadcasting approve,
   then re-fetches after confirmation. If the user has a pending approval from
   another session, the re-fetch may still show the old value briefly.
4. **Relayer pre-approval** — before `manual-fill` works, the deployer wallet must
   hold mUSDC on the destination chain AND have approved the IntentEscrow to spend
   it. See README for the one-time setup cast commands.
