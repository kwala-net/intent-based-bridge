'use client'

import { useEffect, useState } from 'react'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount, useChainId, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { BridgeForm } from './components/BridgeForm'
import { IntentStatus } from './components/IntentStatus'
import { CHAINS } from '@/lib/chains'
import { MOCK_USDC_ABI } from '@/lib/abis'
import type { Intent } from '@/lib/types'

export default function Home() {
  const [activeIntent, setActiveIntent] = useState<Intent | null>(null)
  const [faucetMsg, setFaucetMsg] = useState<string | null>(null)

  // Hydrate the last in-flight intent from localStorage so a refresh doesn't
  // drop the user out of the status view mid-bridge.
  useEffect(() => {
    try {
      const stored = localStorage.getItem('activeIntent')
      if (stored) setActiveIntent(JSON.parse(stored))
    } catch {}
  }, [])

  useEffect(() => {
    if (activeIntent) localStorage.setItem('activeIntent', JSON.stringify(activeIntent))
    else localStorage.removeItem('activeIntent')
  }, [activeIntent])

  const { isConnected } = useAccount()
  const chainId = useChainId()
  const chain = CHAINS[chainId]

  const { writeContractAsync } = useWriteContract()
  const [faucetHash, setFaucetHash] = useState<`0x${string}` | undefined>()
  const { isLoading: isMinting } = useWaitForTransactionReceipt({ hash: faucetHash })

  async function handleFaucet() {
    if (!chain?.mockUsdc) return
    setFaucetMsg(null)
    try {
      const hash = await writeContractAsync({
        address: chain.mockUsdc as `0x${string}`,
        abi: MOCK_USDC_ABI,
        functionName: 'faucet',
      })
      setFaucetHash(hash)
      setFaucetMsg('10,000 mUSDC minted!')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      if (!msg.includes('User rejected')) setFaucetMsg('Faucet failed — check console')
    }
  }

  return (
    <main className="min-h-screen">
      <div className="max-w-lg mx-auto px-4 py-10">
        <header className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Intent Bridge</h1>
            <p className="text-sm text-gray-500 mt-0.5">Sepolia ↔ Avalanche Fuji</p>
          </div>
          <div className="flex items-center gap-3">
            {isConnected && chain && (
              <button
                onClick={handleFaucet}
                disabled={isMinting}
                className="text-sm px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                {isMinting ? 'Minting…' : 'Get test mUSDC'}
              </button>
            )}
            <ConnectButton chainStatus="icon" showBalance={false} />
          </div>
        </header>

        {faucetMsg && (
          <div className="mb-4 text-sm text-center text-green-400 bg-green-900/20 rounded-lg py-2">
            {faucetMsg}
          </div>
        )}

        <BridgeForm onIntentCreated={(intent) => { setActiveIntent(intent) }} />

        {activeIntent && (
          <div className="mt-4">
            <IntentStatus intent={activeIntent} />
          </div>
        )}
      </div>
    </main>
  )
}
