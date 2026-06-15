import { NextRequest, NextResponse } from 'next/server'
import { getMessages, createMessage } from '@/lib/db'

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('sessionId')
  if (!sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 })
  const messages = await getMessages(sessionId)
  return NextResponse.json(messages)
}

export async function POST(req: NextRequest) {
  const { sessionId, role, content } = await req.json()
  if (!sessionId || !role || !content) {
    return NextResponse.json({ error: 'sessionId, role, and content are required' }, { status: 400 })
  }
  const message = await createMessage(sessionId, role, content)
  return NextResponse.json(message)
}
