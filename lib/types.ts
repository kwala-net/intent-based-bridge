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
