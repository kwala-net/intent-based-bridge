'use client'

import { CHAINS } from '@/lib/chains'

const CHAIN_OPTIONS = Object.values(CHAINS)

interface Props {
  srcChainId: number
  dstChainId: number
  onChange: (src: number, dst: number) => void
}

export function ChainSelector({ srcChainId, dstChainId, onChange }: Props) {
  return (
    <div className="flex items-center gap-2">
      <select
        value={srcChainId}
        onChange={(e) => onChange(Number(e.target.value), dstChainId)}
        className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {CHAIN_OPTIONS.map((c) => (
          <option key={c.id} value={c.id} disabled={c.id === dstChainId}>
            {c.name}
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={() => onChange(dstChainId, srcChainId)}
        className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors text-lg"
        title="Swap chains"
      >
        ⇄
      </button>

      <select
        value={dstChainId}
        onChange={(e) => onChange(srcChainId, Number(e.target.value))}
        className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {CHAIN_OPTIONS.map((c) => (
          <option key={c.id} value={c.id} disabled={c.id === srcChainId}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  )
}
