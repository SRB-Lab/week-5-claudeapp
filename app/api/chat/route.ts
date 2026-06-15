import { NextRequest } from 'next/server'
import { createMessage, updateSession } from '@/lib/db'
import { supabaseServer } from '@/lib/supabase-server'

const FALLBACK = 'I was unable to get a response from the AI agent. Please try again.'
const API_VERSION = '2025-05-01'

function getAzureConfig() {
  const apiKey = process.env.AZURE_API_KEY
  const endpointUrl = process.env.AZURE_AGENT_ENDPOINT
  const agentId = process.env.AZURE_AGENT_ID

  if (!apiKey || !endpointUrl) {
    throw new Error('Missing Azure env vars: AZURE_API_KEY, AZURE_AGENT_ENDPOINT')
  }
  if (!agentId) {
    throw new Error('Missing Azure env var: AZURE_AGENT_ID')
  }

  return { apiKey, endpointUrl, agentId }
}

async function azureFetch(url: string, apiKey: string, options: RequestInit = {}) {
  const separator = url.includes('?') ? '&' : '?'
  const res = await fetch(`${url}${separator}api-version=${API_VERSION}`, {
    ...options,
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) ?? {}),
    },
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    const err = new Error(
      `Azure ${res.status}${body ? `: ${body.slice(0, 300)}` : ''}`
    ) as Error & { status: number }
    err.status = res.status
    throw err
  }

  return res.json()
}

export async function POST(req: NextRequest) {
  const { sessionId, userMessage, contractText } = await req.json()

  if (!sessionId || !userMessage) {
    return Response.json({ error: 'sessionId and userMessage are required' }, { status: 400 })
  }

  const userMsg = await createMessage(sessionId, 'user', userMessage)

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

  await updateSession(sessionId, { status: 'processing', updated_at: new Date().toISOString() })

  let assistantText = FALLBACK

  try {
    const { apiKey, endpointUrl, agentId } = getAzureConfig()

    const combinedInput = contractText
      ? `CONTRACT TEXT:\n${contractText}\n\nUSER QUESTION:\n${userMessage}`
      : userMessage

    // 1. Create a new thread
    const thread = await azureFetch(`${endpointUrl}/threads`, apiKey, {
      method: 'POST',
      body: '{}',
    })

    // 2. Add user message to the thread
    await azureFetch(`${endpointUrl}/threads/${thread.id}/messages`, apiKey, {
      method: 'POST',
      body: JSON.stringify({ role: 'user', content: combinedInput }),
    })

    // 3. Resolve agent ID — if it looks like a display name, list agents to find the real asst_xxx ID
    let resolvedAgentId = agentId
    if (!agentId.startsWith('asst_')) {
      const agentList = await azureFetch(`${endpointUrl}/agents`, apiKey)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const match = (agentList.data as any[])?.find(
        (a) => a.name === agentId || a.id === agentId
      )
      if (!match) {
        throw new Error(
          `Agent "${agentId}" not found. Available agents: ${(agentList.data as any[])?.map((a: any) => a.name).join(', ')}`
        )
      }
      resolvedAgentId = match.id
    }

    // 4. Run the thread against the agent
    const run = await azureFetch(`${endpointUrl}/threads/${thread.id}/runs`, apiKey, {
      method: 'POST',
      body: JSON.stringify({ assistant_id: resolvedAgentId }),
    })

    // 5. Poll until completed / failed (max 55s, 2s intervals)
    let runStatus: string = run.status
    const deadline = Date.now() + 55_000
    while (
      !['completed', 'failed', 'cancelled', 'expired'].includes(runStatus) &&
      Date.now() < deadline
    ) {
      await new Promise((r) => setTimeout(r, 2000))
      const polled = await azureFetch(
        `${endpointUrl}/threads/${thread.id}/runs/${run.id}`,
        apiKey
      )
      runStatus = polled.status
    }

    if (runStatus !== 'completed') {
      throw new Error(`Agent run ended with status: ${runStatus}`)
    }

    // 6. Retrieve messages and extract the latest assistant reply
    const messages = await azureFetch(`${endpointUrl}/threads/${thread.id}/messages`, apiKey)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const assistantMsg = (messages.data as any[])?.find((m) => m.role === 'assistant')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const firstContent = assistantMsg?.content?.[0] as any
    assistantText =
      firstContent?.type === 'text' ? (firstContent.text?.value ?? FALLBACK) : FALLBACK

    await updateSession(sessionId, { status: 'completed', updated_at: new Date().toISOString() })
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err)
    const httpStatus = (err as { status?: number }).status ?? 0
    console.error('[Azure chat error]', httpStatus, errMsg)

    await updateSession(sessionId, { status: 'error', updated_at: new Date().toISOString() })

    if (errMsg.includes('Missing Azure env var')) {
      const msg = `Azure is not configured: ${errMsg}. Add the missing variable to your Netlify environment variables.`
      await createMessage(sessionId, 'assistant', msg)
      return Response.json(
        { assistantMessage: msg, userMessageId: userMsg.id, assistantMessageId: '', sessionTitle },
        { status: 500 }
      )
    }

    if (httpStatus === 401 || httpStatus === 403) {
      const msg = `Azure authentication failed (${httpStatus}). Check your AZURE_API_KEY in Netlify environment variables.`
      await createMessage(sessionId, 'assistant', msg)
      return Response.json(
        { assistantMessage: msg, userMessageId: userMsg.id, assistantMessageId: '', sessionTitle },
        { status: httpStatus }
      )
    }

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
