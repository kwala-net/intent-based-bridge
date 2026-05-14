import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { http } from 'viem'
import { sepolia, avalancheFuji } from 'wagmi/chains'

// ssr: true enables cookie-based hydration for Next.js App Router.
// This config is safe to import in both server and client modules —
// wagmi only accesses browser APIs lazily, after hydration.
//
// Transports are pinned to the publicnode endpoints from NEXT_PUBLIC_*_RPC_URL.
// Without this, viem falls back to its default public RPCs which rate-limit
// `eth_getTransactionReceipt`, causing waitForTransactionReceipt to hang for
// many blocks after a tx is mined (button stuck on "Approving…").
export const wagmiConfig = getDefaultConfig({
  appName: 'Intent Bridge',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'demo-project-id',
  chains: [sepolia, avalancheFuji],
  transports: {
    [sepolia.id]:        http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL),
    [avalancheFuji.id]:  http(process.env.NEXT_PUBLIC_FUJI_RPC_URL),
  },
  ssr: true,
})
