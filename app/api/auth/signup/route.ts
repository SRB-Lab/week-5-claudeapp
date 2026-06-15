import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getUser, createUser } from '@/lib/db'

export async function POST(req: NextRequest) {
  const { email, password } = await req.json()

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
  }

  const existing = await getUser(email)
  if (existing) {
    return NextResponse.json({ error: 'Email already registered' }, { status: 400 })
  }

  const passwordHash = await bcrypt.hash(password, 10)
  const user = await createUser(email, passwordHash)

  return NextResponse.json({ id: user.id, email: user.email })
}
