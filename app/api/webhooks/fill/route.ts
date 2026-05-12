import { NextRequest, NextResponse } from 'next/server'
import { updateIntent } from '@/lib/storage'
import { WebhookFillPayload } from '@/lib/types'

export async function POST(req: NextRequest) {
  if (req.headers.get('x-webhook-secret') !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const body: WebhookFillPayload = await req.json()
  const { intentId, txHash } = body

  const updated = updateIntent(intentId, {
    status:    'filled',
    fillTxHash: txHash,
    filledAt:  new Date().toISOString(),
  })

  if (!updated) {
    return NextResponse.json({ error: 'intent not found' }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}
