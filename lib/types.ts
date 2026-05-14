export type IntentStatus = 'pending' | 'filled' | 'expired' | 'reclaimed'

export interface Intent {
  id: string           // bytes32 intentId as 0x-prefixed hex
  user: string
  srcChainId: number
  dstChainId: number
  inputToken: string
  inputAmount: string  // bigint serialised as decimal string
  outputToken: string
  outputAmount: string
  recipient: string
  fillDeadline: number // unix seconds
  nonce: string        // bigint serialised as decimal string
  status: IntentStatus
  depositTxHash?: string
  fillTxHash?: string
  filledAt?: string    // ISO string
  inventory?: string   // destination-chain wallet whose allowance funded the fill
  createdAt: string    // ISO string
}

export interface QuoteRequest {
  srcChainId: number
  dstChainId: number
  inputToken: string
  inputAmount: string
  outputToken: string
}

export interface QuoteResponse {
  outputAmount: string
  feeBps: number
  fillDeadline: number
}

// Shape of the body Kwala POSTs to /api/webhooks/fill.
// Every field here is either an event param or derivable from tx context.
export interface WebhookFillPayload {
  intentId: string       // IntentFilled.intentId  (indexed bytes32)
  originChainId: number  // IntentFilled.originChainId (indexed uint256)
  relayer: string        // IntentFilled.relayer (indexed address)
  recipient: string      // IntentFilled.recipient
  outputToken: string    // IntentFilled.outputToken
  outputAmount: string   // IntentFilled.outputAmount (as decimal string)
  inventory: string      // IntentFilled.inventory — destination-chain wallet that paid
  txHash: string         // from tx context
  chainId: number        // destination chain id, from tx context
}
