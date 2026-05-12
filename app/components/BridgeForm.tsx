'use client'

import { useState, useEffect } from 'react'
import {
  useAccount,
  useChainId,
  useSwitchChain,
  useWriteContract,
  useReadContract,
} from 'wagmi'
import { waitForTransactionReceipt } from 'wagmi/actions'
import { parseUnits, formatUnits, parseEventLogs } from 'viem'
import { wagmiConfig } from '@/lib/wagmi'
import { CHAINS } from '@/lib/chains'
import { INTENT_ESCROW_ABI, MOCK_USDC_ABI } from '@/lib/abis'
import { ChainSelector } from './ChainSelector'
import type { Intent, QuoteResponse } from '@/lib/types'

interface Props {
  onIntentCreated: (intent: Intent) => void
}

export function BridgeForm({ onIntentCreated }: Props) {
  const { address, isConnected } = useAccount()
  const connectedChainId = useChainId()
  const { switchChain } = useSwitchChain()
  const { writeContractAsync } = useWriteContract()

  const [srcChainId, setSrcChainId] = useState(11155111)
  const [dstChainId, setDstChainId] = useState(43113)
  const [amount, setAmount] = useState('')
  const [recipient, setRecipient] = useState('')
  const [quote, setQuote] = useState<QuoteResponse | null>(null)
  const [isQuoting, setIsQuoting] = useState(false)
  const [step, setStep] = useState<'idle' | 'approving' | 'creating'>('idle')
  const [error, setError] = useState<string | null>(null)

  const srcChain = CHAINS[srcChainId]
  const dstChain = CHAINS[dstChainId]

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: srcChain?.mockUsdc as `0x${string}`,
    abi: MOCK_USDC_ABI,
    functionName: 'allowance',
    args: [
      (address ?? '0x0000000000000000000000000000000000000000') as `0x${string}`,
      srcChain?.intentEscrow as `0x${string}`,
    ],
    query: { enabled: !!address && !!srcChain?.mockUsdc && !!srcChain?.intentEscrow },
  })

  // Default recipient to connected wallet
  useEffect(() => {
    if (address && !recipient) setRecipient(address)
  }, [address]) // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced quote fetch
  useEffect(() => {
    const n = Number(amount)
    if (!amount || isNaN(n) || n <= 0) { setQuote(null); return }
    if (!srcChain?.mockUsdc || !dstChain?.mockUsdc) return

    setIsQuoting(true)
    const t = setTimeout(async () => {
      try {
        const res = await fetch('/api/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            srcChainId,
            dstChainId,
            inputToken: srcChain.mockUsdc,
            inputAmount: parseUnits(amount, 18).toString(),
            outputToken: dstChain.mockUsdc,
          }),
        })
        setQuote(res.ok ? await res.json() : null)
      } catch { setQuote(null) }
      finally { setIsQuoting(false) }
    }, 500)
    return () => clearTimeout(t)
  }, [amount, srcChainId, dstChainId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleBridge() {
    if (!address || !quote || !srcChain || !dstChain) return
    setError(null)

    const inputAmount = parseUnits(amount, 18)
    const recipientAddr = (recipient || address) as `0x${string}`

    try {
      // Step 1: approve if needed
      if ((allowance ?? 0n) < inputAmount) {
        setStep('approving')
        const approveTx = await writeContractAsync({
          address: srcChain.mockUsdc as `0x${string}`,
          abi: MOCK_USDC_ABI,
          functionName: 'approve',
          args: [srcChain.intentEscrow as `0x${string}`, inputAmount],
        })
        await waitForTransactionReceipt(wagmiConfig, { hash: approveTx })
        await refetchAllowance()
      }

      // Step 2: create intent
      setStep('creating')
      const createTx = await writeContractAsync({
        address: srcChain.intentEscrow as `0x${string}`,
        abi: INTENT_ESCROW_ABI,
        functionName: 'createIntent',
        args: [
          srcChain.mockUsdc  as `0x${string}`,
          inputAmount,
          BigInt(dstChainId),
          dstChain.mockUsdc  as `0x${string}`,
          BigInt(quote.outputAmount),
          recipientAddr,
          quote.fillDeadline,
        ],
      })

      const receipt = await waitForTransactionReceipt(wagmiConfig, { hash: createTx })

      // Extract intentId and nonce directly from the emitted event
      const logs = parseEventLogs({
        abi: INTENT_ESCROW_ABI,
        logs: receipt.logs,
        eventName: 'IntentCreated',
      })
      if (!logs[0]) throw new Error('IntentCreated event not found in receipt')

      const { intentId, nonce } = logs[0].args

      const intent: Intent = {
        id:            intentId,
        user:          address,
        srcChainId,
        dstChainId,
        inputToken:    srcChain.mockUsdc,
        inputAmount:   inputAmount.toString(),
        outputToken:   dstChain.mockUsdc,
        outputAmount:  quote.outputAmount,
        recipient:     recipientAddr,
        fillDeadline:  quote.fillDeadline,
        nonce:         nonce.toString(),
        status:        'pending',
        depositTxHash: createTx,
        createdAt:     new Date().toISOString(),
      }

      // Persist to backend JSON store
      await fetch('/api/intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(intent),
      })

      onIntentCreated(intent)
      setAmount('')
      setQuote(null)
      setRecipient(address)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      // User-rejected txs are noisy — surface meaningful errors only
      if (!msg.includes('User rejected')) setError(msg)
    } finally {
      setStep('idle')
    }
  }

  function handleChainChange(src: number, dst: number) {
    setSrcChainId(src)
    setDstChainId(dst)
    setQuote(null)
  }

  const needsSwitch = isConnected && connectedChainId !== srcChainId
  const isBusy = step !== 'idle'
  const canBridge = isConnected && !isBusy && !!amount && !!quote && !needsSwitch

  return (
    <div className="bg-gray-900 rounded-2xl p-6 space-y-4 border border-gray-800">
      <h2 className="text-lg font-semibold">Bridge Tokens</h2>

      <ChainSelector srcChainId={srcChainId} dstChainId={dstChainId} onChange={handleChainChange} />

      {needsSwitch && (
        <div className="flex items-center justify-between bg-yellow-900/30 border border-yellow-700/60 rounded-lg px-3 py-2.5 text-sm">
          <span>Switch wallet to <strong>{srcChain?.name}</strong> to bridge</span>
          <button
            onClick={() => switchChain({ chainId: srcChainId })}
            className="ml-3 px-3 py-1 bg-yellow-600 hover:bg-yellow-500 rounded-md font-medium transition-colors"
          >
            Switch
          </button>
        </div>
      )}

      <div>
        <label className="block text-sm text-gray-400 mb-1">Amount</label>
        <div className="relative">
          <input
            type="number"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.0"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 pr-20 text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">mUSDC</span>
        </div>
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-1">Recipient</label>
        <input
          type="text"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          placeholder="0x…"
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {(isQuoting || quote) && (
        <div className="bg-gray-800/50 rounded-lg p-3 text-sm space-y-1.5">
          {isQuoting ? (
            <p className="text-gray-400">Calculating quote…</p>
          ) : quote ? (
            <>
              <Row label="You receive" value={`${formatUnits(BigInt(quote.outputAmount), 18)} mUSDC`} />
              <Row label="Relayer fee" value={`${quote.feeBps} bps (0.20%)`} />
              <Row label="Fill deadline" value={new Date(quote.fillDeadline * 1000).toLocaleTimeString()} />
            </>
          ) : null}
        </div>
      )}

      {error && (
        <p className="text-sm text-red-400 bg-red-900/20 rounded-lg px-3 py-2 break-all">{error}</p>
      )}

      <button
        onClick={handleBridge}
        disabled={!canBridge}
        className="w-full py-3 rounded-xl font-semibold transition-all bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {!isConnected  ? 'Connect Wallet' :
         needsSwitch   ? 'Wrong Network'  :
         step === 'approving' ? 'Approving…'  :
         step === 'creating'  ? 'Bridging…'   :
         'Bridge'}
      </button>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-400">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}
