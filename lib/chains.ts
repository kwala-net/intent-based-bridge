export interface ChainConfig {
  id: number
  name: string
  rpcUrl: string
  explorer: string
  intentEscrow: string
  mockUsdc: string
}

export const CHAINS: Record<number, ChainConfig> = {
  11155111: {
    id: 11155111,
    name: 'Ethereum Sepolia',
    rpcUrl: process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || 'https://rpc.sepolia.org',
    explorer: 'https://sepolia.etherscan.io',
    intentEscrow: process.env.NEXT_PUBLIC_INTENT_ESCROW_SEPOLIA || '',
    mockUsdc: process.env.NEXT_PUBLIC_MOCK_USDC_SEPOLIA || '',
  },
  43113: {
    id: 43113,
    name: 'Avalanche Fuji',
    rpcUrl: process.env.NEXT_PUBLIC_FUJI_RPC_URL || 'https://api.avax-test.network/ext/bc/C/rpc',
    explorer: 'https://testnet.snowtrace.io',
    intentEscrow: process.env.NEXT_PUBLIC_INTENT_ESCROW_FUJI || '',
    mockUsdc: process.env.NEXT_PUBLIC_MOCK_USDC_FUJI || '',
  },
}

export const SUPPORTED_CHAIN_IDS = [11155111, 43113] as const
