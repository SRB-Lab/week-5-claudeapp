import { NextRequest, NextResponse } from 'next/server'
import { createFeedback } from '@/lib/db'

export async function POST(req: NextRequest) {
  const { userId, sessionId, rating, comment } = await req.json()

  if (!userId || !sessionId || !rating) {
    return NextResponse.json({ error: 'userId, sessionId, and rating are required' }, { status: 400 })
  }
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: 'Rating must be an integer between 1 and 5' }, { status: 400 })
  }

  const feedback = await createFeedback(userId, sessionId, rating, comment)
  return NextResponse.json({ success: true, feedback })
}
