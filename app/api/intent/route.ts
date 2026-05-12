import { NextRequest, NextResponse } from 'next/server'
import { saveIntent } from '@/lib/storage'
import { Intent } from '@/lib/types'

export async function POST(req: NextRequest) {
  const body = await req.json()

  const intent: Intent = {
    id:            body.id,
    user:          body.user,
    srcChainId:    body.srcChainId,
    dstChainId:    body.dstChainId,
    inputToken:    body.inputToken,
    inputAmount:   body.inputAmount,
    outputToken:   body.outputToken,
    outputAmount:  body.outputAmount,
    recipient:     body.recipient,
    fillDeadline:  body.fillDeadline,
    nonce:         body.nonce,
    status:        'pending',
    depositTxHash: body.depositTxHash,
    createdAt:     new Date().toISOString(),
  }

  saveIntent(intent)
  return NextResponse.json(intent, { status: 201 })
}
