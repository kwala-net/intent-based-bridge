import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { sepolia, avalancheFuji } from 'wagmi/chains'

// ssr: true enables cookie-based hydration for Next.js App Router.
// This config is safe to import in both server and client modules —
// wagmi only accesses browser APIs lazily, after hydration.
export const wagmiConfig = getDefaultConfig({
  appName: 'Intent Bridge',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'demo-project-id',
  chains: [sepolia, avalancheFuji],
  ssr: true,
})
