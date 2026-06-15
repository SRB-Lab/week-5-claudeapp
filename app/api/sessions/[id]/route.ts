import { NextRequest, NextResponse } from 'next/server'
import { updateSession, deleteSession } from '@/lib/db'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const patch = await req.json()
  const session = await updateSession(params.id, patch)
  return NextResponse.json(session)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await deleteSession(params.id)
  return NextResponse.json({ success: true })
}
