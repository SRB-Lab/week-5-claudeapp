import { NextRequest } from 'next/server'
import { createMessage, updateSession } from '@/lib/db'
import { getAzureClient } from '@/lib/azure'
import { supabaseServer } from '@/lib/supabase-server'

const FALLBACK = 'I was unable to get a response from the AI agent. Please try again.'

export async function POST(req: NextRequest) {
  const { sessionId, userMessage, contractText } = await req.json()

  if (!sessionId || !userMessage) {
    return Response.json({ error: 'sessionId and userMessage are required' }, { status: 400 })
  }

  // Save user message to DB
  const userMsg = await createMessage(sessionId, 'user', userMessage)

  // Auto-title: replace default title with first 55 chars of first user message
  const { data: session } = await supabaseServer
    .from('sessions')
    .select('title')
    .eq('id', sessionId)
    .single()

  let sessionTitle: string = session?.title ?? 'New session'
  if (session?.title === 'New session') {
    sessionTitle = userMessage.slice(0, 55) + (userMessage.length > 55 ? '…' : '')
    await updateSession(sessionId, { title: sessionTitle })
  }

  // Mark session as processing
  await updateSession(sessionId, { status: 'processing', updated_at: new Date().toISOString() })

  let assistantText = FALLBACK

  try {
    const openai = getAzureClient()

    const combinedInput = contractText
      ? `CONTRACT TEXT:\n${contractText}\n\nUSER QUESTION:\n${userMessage}`
      : userMessage

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await (openai.responses.create as any)({
      input: [{ role: 'user', content: combinedInput }],
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const firstOutput = response.output?.find((o: any) => o.type === 'message')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawText = firstOutput?.content?.find((c: any) => c.type === 'output_text')?.text
    assistantText = response.output_text ?? rawText ?? FALLBACK

    await updateSession(sessionId, { status: 'completed', updated_at: new Date().toISOString() })
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err)
    const httpStatus = (err as { status?: number }).status ?? 0
    console.error('[Azure chat error]', httpStatus, errMsg)

    await updateSession(sessionId, { status: 'error', updated_at: new Date().toISOString() })

    // Surface missing env vars clearly
    if (errMsg.includes('Missing Azure env vars')) {
      const msg = 'Azure is not configured. Add AZURE_API_KEY and AZURE_AGENT_ENDPOINT to your Netlify environment variables.'
      await createMessage(sessionId, 'assistant', msg)
      return Response.json({ assistantMessage: msg, userMessageId: userMsg.id, assistantMessageId: '', sessionTitle }, { status: 500 })
    }

    if (httpStatus === 401 || httpStatus === 403) {
      const msg = `Azure authentication failed (${httpStatus}). Check your AZURE_API_KEY in Netlify environment variables.`
      await createMessage(sessionId, 'assistant', msg)
      return Response.json({ assistantMessage: msg, userMessageId: userMsg.id, assistantMessageId: '', sessionTitle }, { status: httpStatus })
    }

    // Return the raw error as the assistant message so it's visible in chat
    assistantText = `Error from Azure: ${errMsg}`
  }

  const assistantMsg = await createMessage(sessionId, 'assistant', assistantText)

  return Response.json({
    assistantMessage: assistantText,
    userMessageId: userMsg.id,
    assistantMessageId: assistantMsg.id,
    sessionTitle,
  })
}
