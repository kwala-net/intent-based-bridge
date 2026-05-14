import { NextRequest, NextResponse } from 'next/server'
import { updateIntent } from '@/lib/storage'
import { WebhookFillPayload } from '@/lib/types'

export async function POST(req: NextRequest) {
  const body: WebhookFillPayload = await req.json()
  const { intentId, txHash, inventory } = body

  const updated = updateIntent(intentId, {
    status:    'filled',
    fillTxHash: txHash,
    filledAt:  new Date().toISOString(),
    inventory,
  })

  if (!updated) {
    return NextResponse.json({ error: 'intent not found' }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}
