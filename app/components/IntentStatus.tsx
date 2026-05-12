'use client'

import { useState, useEffect } from 'react'
import { formatUnits } from 'viem'
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { CHAINS } from '@/lib/chains'
import { INTENT_ESCROW_ABI } from '@/lib/abis'
import type { Intent } from '@/lib/types'

export function IntentStatus({ intent: initial }: { intent: Intent }) {
  const [intent, setIntent] = useState(initial)
  const [elapsed, setElapsed] = useState(0)

  const { writeContract, data: reclaimHash } = useWriteContract()
  const { isLoading: isReclaiming, isSuccess: reclaimDone } =
    useWaitForTransactionReceipt({ hash: reclaimHash })

  // Poll every 3 s until terminal state
  useEffect(() => {
    if (intent.status === 'filled' || intent.status === 'reclaimed') return
    const iv = setInterval(async () => {
      try {
        const res = await fetch(`/api/intent/${intent.id}`)
        if (res.ok) setIntent(await res.json())
      } catch {}
    }, 3000)
    return () => clearInterval(iv)
  }, [intent.id, intent.status])

  // Elapsed timer while pending
  useEffect(() => {
    if (intent.status !== 'pending') return
    const start = Date.now()
    const iv = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000)
    return () => clearInterval(iv)
  }, [intent.status])

  // Mark reclaimed locally once tx confirms
  useEffect(() => {
    if (reclaimDone) setIntent((p) => ({ ...p, status: 'reclaimed' }))
  }, [reclaimDone])

  function handleReclaim() {
    const chain = CHAINS[intent.srcChainId]
    writeContract({
      address: chain.intentEscrow as `0x${string}`,
      abi: INTENT_ESCROW_ABI,
      functionName: 'reclaim',
      args: [intent.id as `0x${string}`],
    })
  }

  const dstChain = CHAINS[intent.dstChainId]
  const out = formatUnits(BigInt(intent.outputAmount), 18)

  return (
    <div className="bg-gray-900 rounded-2xl p-5 space-y-3 border border-gray-800">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Transaction Status</p>
      <p className="text-xs font-mono text-gray-600 truncate">{intent.id}</p>

      {intent.status === 'pending' && (
        <div className="flex items-start gap-3">
          <div className="mt-0.5 w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
          <div>
            <p className="font-medium">Your funds are on the way to {dstChain?.name}</p>
            <p className="text-sm text-gray-400">ETA ~30 seconds · {elapsed}s elapsed</p>
          </div>
        </div>
      )}

      {intent.status === 'filled' && (
        <div className="flex items-start gap-3">
          <div className="mt-0.5 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0 text-xs font-bold">✓</div>
          <div className="space-y-1">
            <p className="font-medium text-green-400">Done! {out} mUSDC delivered</p>
            <p className="text-sm text-gray-400">
              to {intent.recipient.slice(0, 6)}…{intent.recipient.slice(-4)} on {dstChain?.name}
            </p>
            {intent.fillTxHash && dstChain && (
              <a
                href={`${dstChain.explorer}/tx/${intent.fillTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-400 hover:underline"
              >
                View on explorer →
              </a>
            )}
          </div>
        </div>
      )}

      {intent.status === 'expired' && (
        <div className="flex items-start gap-3">
          <div className="mt-0.5 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0 text-xs font-bold">!</div>
          <div className="space-y-2">
            <p className="font-medium text-red-400">Intent expired — not filled in time</p>
            <button
              onClick={handleReclaim}
              disabled={isReclaiming}
              className="px-4 py-1.5 bg-red-600 hover:bg-red-500 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {isReclaiming ? 'Reclaiming…' : 'Reclaim funds'}
            </button>
          </div>
        </div>
      )}

      {intent.status === 'reclaimed' && (
        <div className="flex items-start gap-3">
          <div className="mt-0.5 w-5 h-5 rounded-full bg-gray-600 flex items-center justify-center flex-shrink-0 text-xs">↩</div>
          <div>
            <p className="font-medium text-gray-300">Funds reclaimed</p>
            <p className="text-sm text-gray-500">Your tokens were returned to your wallet.</p>
          </div>
        </div>
      )}
    </div>
  )
}
