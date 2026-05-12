import { NextRequest, NextResponse } from 'next/server'
import { readIntents, updateIntent } from '@/lib/storage'

// Called by Kwala on a schedule (e.g. every 30 seconds).
// Marks pending intents whose fillDeadline has passed as expired.
export async function POST(_req: NextRequest) {
  const now = Math.floor(Date.now() / 1000)
  const intents = readIntents()
  const expired: string[] = []

  for (const [id, intent] of Object.entries(intents)) {
    if (intent.status === 'pending' && intent.fillDeadline < now) {
      updateIntent(id, { status: 'expired' })
      expired.push(id)
    }
  }

  return NextResponse.json({ expired: expired.length, ids: expired })
}
