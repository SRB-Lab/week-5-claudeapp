import { supabaseServer } from './supabase-server'

// ── Users ─────────────────────────────────────────────────────────────────────

export async function getUser(email: string) {
  const { data } = await supabaseServer
    .from('users')
    .select('*')
    .eq('email', email)
    .single()
  return data
}

export async function createUser(email: string, passwordHash: string) {
  const { data, error } = await supabaseServer
    .from('users')
    .insert({ email, password_hash: passwordHash })
    .select()
    .single()
  if (error) throw error
  return data
}

// ── Sessions ──────────────────────────────────────────────────────────────────

export async function createSession(userId: string, title = 'New session') {
  const { data, error } = await supabaseServer
    .from('sessions')
    .insert({ user_id: userId, title })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getSessions(userId: string) {
  const { data, error } = await supabaseServer
    .from('sessions')
    .select('*')
    .eq('user_id', userId)
    .order('pinned', { ascending: false })
    .order('updated_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function updateSession(
  id: string,
  patch: { title?: string; pinned?: boolean; status?: string; updated_at?: string }
) {
  const { data, error } = await supabaseServer
    .from('sessions')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteSession(id: string) {
  const { error } = await supabaseServer.from('sessions').delete().eq('id', id)
  if (error) throw error
}

// ── Messages ──────────────────────────────────────────────────────────────────

export async function createMessage(sessionId: string, role: string, content: string) {
  const { data, error } = await supabaseServer
    .from('messages')
    .insert({ session_id: sessionId, role, content })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getMessages(sessionId: string) {
  const { data, error } = await supabaseServer
    .from('messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

// ── Feedback ──────────────────────────────────────────────────────────────────

export async function createFeedback(
  userId: string,
  sessionId: string,
  rating: number,
  comment?: string
) {
  const { data, error } = await supabaseServer
    .from('feedback')
    .insert({ user_id: userId, session_id: sessionId, rating, comment })
    .select()
    .single()
  if (error) throw error
  return data
}
