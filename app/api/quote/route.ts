import { NextRequest, NextResponse } from 'next/server'
import { SUPPORTED_CHAIN_IDS } from '@/lib/chains'

const FEE_BPS = 20
const FILL_DEADLINE_SECS = 300

export async function POST(req: NextRequest) {
  const { srcChainId, dstChainId, inputToken, inputAmount, outputToken } = await req.json()

  if (!SUPPORTED_CHAIN_IDS.includes(srcChainId) || !SUPPORTED_CHAIN_IDS.includes(dstChainId)) {
    return NextResponse.json({ error: 'unsupported chain' }, { status: 400 })
  }
  if (srcChainId === dstChainId) {
    return NextResponse.json({ error: 'src and dst must differ' }, { status: 400 })
  }
  if (!inputToken || !outputToken || !inputAmount) {
    return NextResponse.json({ error: 'missing fields' }, { status: 400 })
  }

  const outputAmount = (BigInt(inputAmount) * 9980n / 10000n).toString()
  const fillDeadline = Math.floor(Date.now() / 1000) + FILL_DEADLINE_SECS

  return NextResponse.json({ outputAmount, feeBps: FEE_BPS, fillDeadline })
}
