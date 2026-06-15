import { NextRequest, NextResponse } from 'next/server'
import { getSessions, createSession } from '@/lib/db'

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId')
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })
  const sessions = await getSessions(userId)
  return NextResponse.json(sessions)
}

export async function POST(req: NextRequest) {
  const { userId, title } = await req.json()
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })
  const session = await createSession(userId, title)
  return NextResponse.json(session)
}
