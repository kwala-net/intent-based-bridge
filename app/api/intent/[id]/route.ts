import { NextRequest, NextResponse } from 'next/server'
import { getIntent } from '@/lib/storage'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const intent = getIntent(params.id)
  if (!intent) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json(intent)
}
