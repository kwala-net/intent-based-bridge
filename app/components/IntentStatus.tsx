'use client'

import { useEffect, useState } from 'react'
import { formatUnits, parseAbiItem } from 'viem'
import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { getPublicClient } from 'wagmi/actions'
import { wagmiConfig } from '@/lib/wagmi'
import { CHAINS } from '@/lib/chains'
import { INTENT_ESCROW_ABI } from '@/lib/abis'
import type { Intent, IntentStatus as IntentStatusKind } from '@/lib/types'

const INTENT_FILLED_EVENT = parseAbiItem(
  'event IntentFilled(bytes32 indexed intentId, uint256 indexed originChainId, address indexed relayer, address recipient, address outputToken, uint256 outputAmount, address inventory)'
)

export function IntentStatus({ intent }: { intent: Intent }) {
  const [elapsed, setElapsed] = useState(0)
  const [fillTxHash, setFillTxHash] = useState<`0x${string}` | undefined>()
  const [localStatus, setLocalStatus] = useState<IntentStatusKind | null>(null)

  const srcChain = CHAINS[intent.srcChainId]
  const dstChain = CHAINS[intent.dstChainId]

  // Destination: has the relayer filled this intent?
  const { data: isFilled } = useReadContract({
    address: dstChain?.intentEscrow as `0x${string}`,
    abi: INTENT_ESCROW_ABI,
    functionName: 'filled',
    args: [intent.id as `0x${string}`],
    chainId: intent.dstChainId,
    query: {
      refetchInterval: localStatus === 'filled' || localStatus === 'reclaimed' ? false : 3_000,
    },
  })

  // Origin: has the user reclaimed (after deadline)?
  // intents() returns the struct as a tuple; reclaimed is index 8.
  const { data: intentTuple } = useReadContract({
    address: srcChain?.intentEscrow as `0x${string}`,
    abi: INTENT_ESCROW_ABI,
    functionName: 'intents',
    args: [intent.id as `0x${string}`],
    chainId: intent.srcChainId,
    query: {
      refetchInterval: localStatus === 'filled' || localStatus === 'reclaimed' ? false : 3_000,
    },
  })
  const reclaimed = Array.isArray(intentTuple) ? Boolean(intentTuple[8]) : false

  // Derive status purely from on-chain state + clock.
  const now = Math.floor(Date.now() / 1000)
  const derivedStatus: IntentStatusKind =
    isFilled                          ? 'filled'    :
    reclaimed                         ? 'reclaimed' :
    now > intent.fillDeadline         ? 'expired'   :
    'pending'

  const status = localStatus ?? derivedStatus

  // Reclaim flow (unchanged shape; we just no longer round-trip through an API).
  const { writeContract, data: reclaimHash } = useWriteContract()
  const { isLoading: isReclaiming, isSuccess: reclaimDone } =
    useWaitForTransactionReceipt({ hash: reclaimHash })

  useEffect(() => {
    if (reclaimDone) setLocalStatus('reclaimed')
  }, [reclaimDone])

  // Elapsed timer while pending
  useEffect(() => {
    if (status !== 'pending') return
    const start = Date.now()
    const iv = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000)
    return () => clearInterval(iv)
  }, [status])

  // Once filled, fetch the destination tx hash for the explorer link.
  useEffect(() => {
    if (!isFilled || fillTxHash || !dstChain?.intentEscrow) return
    let cancelled = false
    ;(async () => {
      try {
        const client = getPublicClient(wagmiConfig, { chainId: intent.dstChainId as 11155111 | 43113 })
        if (!client) return
        const latest = await client.getBlockNumber()
        const fromBlock = latest > 50_000n ? latest - 50_000n : 0n
        const logs = await client.getLogs({
          address: dstChain.intentEscrow as `0x${string}`,
          event: INTENT_FILLED_EVENT,
          args: { intentId: intent.id as `0x${string}` },
          fromBlock,
          toBlock: 'latest',
        })
        if (!cancelled && logs[0]) setFillTxHash(logs[0].transactionHash)
      } catch {
        // Silent — the link is gracenote, status is still correct.
      }
    })()
    return () => { cancelled = true }
  }, [isFilled, fillTxHash, intent.id, intent.dstChainId, dstChain?.intentEscrow])

  function handleReclaim() {
    if (!srcChain) return
    writeContract({
      address: srcChain.intentEscrow as `0x${string}`,
      abi: INTENT_ESCROW_ABI,
      functionName: 'reclaim',
      args: [intent.id as `0x${string}`],
    })
  }

  const out = formatUnits(BigInt(intent.outputAmount), 18)

  return (
    <div className="bg-gray-900 rounded-2xl p-5 space-y-3 border border-gray-800">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Transaction Status</p>
      <p className="text-xs font-mono text-gray-600 truncate">{intent.id}</p>

      {status === 'pending' && (
        <div className="flex items-start gap-3">
          <div className="mt-0.5 w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
          <div>
            <p className="font-medium">Your funds are on the way to {dstChain?.name}</p>
            <p className="text-sm text-gray-400">ETA ~30 seconds · {elapsed}s elapsed</p>
          </div>
        </div>
      )}

      {status === 'filled' && (
        <div className="flex items-start gap-3">
          <div className="mt-0.5 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0 text-xs font-bold">✓</div>
          <div className="space-y-1">
            <p className="font-medium text-green-400">Done! {out} mUSDC delivered</p>
            <p className="text-sm text-gray-400">
              to {intent.recipient.slice(0, 6)}…{intent.recipient.slice(-4)} on {dstChain?.name}
            </p>
            {fillTxHash && dstChain && (
              <a
                href={`${dstChain.explorer}/tx/${fillTxHash}`}
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

      {status === 'expired' && (
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

      {status === 'reclaimed' && (
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
