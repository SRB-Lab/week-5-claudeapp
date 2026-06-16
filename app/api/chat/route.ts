import { NextRequest } from 'next/server'
import { createMessage, updateSession } from '@/lib/db'
import { supabaseServer } from '@/lib/supabase-server'

const FALLBACK = 'I was unable to get a response from the AI agent. Please try again.'
const API_VERSION = '2025-05-01'

// Module-level token cache (survives across requests in same function instance)
let tokenCache: { token: string; expiresAt: number } | null = null

async function getAzureToken(): Promise<string> {
  const clientId = process.env.AZURE_CLIENT_ID
  const clientSecret = process.env.AZURE_CLIENT_SECRET
  const tenantId = process.env.AZURE_TENANT_ID

  if (!clientId || !clientSecret || !tenantId) {
    throw new Error(
      'Missing Azure OAuth env vars: AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_TENANT_ID'
    )
  }

  // Return cached token if still valid (2 min buffer)
  if (tokenCache && tokenCache.expiresAt > Date.now() + 120_000) {
    return tokenCache.token
  }

  const res = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
        scope: 'https://cognitiveservices.azure.com/.default',
      }).toString(),
    }
  )

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Failed to get Azure AD token (${res.status}): ${body.slice(0, 200)}`)
  }

  const data = await res.json()
  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  }
  return tokenCache.token
}

async function azureFetch(url: string, token: string, options: RequestInit = {}) {
  const separator = url.includes('?') ? '&' : '?'
  const res = await fetch(`${url}${separator}api-version=${API_VERSION}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
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

function getEndpointConfig() {
  const endpointUrl = process.env.AZURE_AGENT_ENDPOINT
  const agentId = process.env.AZURE_AGENT_ID

  if (!endpointUrl) throw new Error('Missing Azure env var: AZURE_AGENT_ENDPOINT')
  if (!agentId) throw new Error('Missing Azure env var: AZURE_AGENT_ID')

  return { endpointUrl, agentId }
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
    const token = await getAzureToken()
    const { endpointUrl, agentId } = getEndpointConfig()

    const combinedInput = contractText
      ? `CONTRACT TEXT:\n${contractText}\n\nUSER QUESTION:\n${userMessage}`
      : userMessage

    // 1. Resolve agent display name → asst_xxx ID if needed
    let resolvedAgentId = agentId
    if (!agentId.startsWith('asst_')) {
      const agentList = await azureFetch(`${endpointUrl}/agents`, token)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const match = (agentList.data as any[])?.find((a) => a.name === agentId || a.id === agentId)
      if (!match) {
        const names = (agentList.data as any[])?.map((a: any) => a.name).join(', ') // eslint-disable-line @typescript-eslint/no-explicit-any
        throw new Error(`Agent "${agentId}" not found. Available: ${names}`)
      }
      resolvedAgentId = match.id
    }

    // 2. Create a new thread
    const thread = await azureFetch(`${endpointUrl}/threads`, token, {
      method: 'POST',
      body: '{}',
    })

    // 3. Add user message to the thread
    await azureFetch(`${endpointUrl}/threads/${thread.id}/messages`, token, {
      method: 'POST',
      body: JSON.stringify({ role: 'user', content: combinedInput }),
    })

    // 4. Run the thread against the agent
    const run = await azureFetch(`${endpointUrl}/threads/${thread.id}/runs`, token, {
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
        token
      )
      runStatus = polled.status
    }

    if (runStatus !== 'completed') {
      throw new Error(`Agent run ended with status: ${runStatus}`)
    }

    // 6. Retrieve messages and extract the latest assistant reply
    const messages = await azureFetch(`${endpointUrl}/threads/${thread.id}/messages`, token)
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

    if (errMsg.includes('Missing Azure')) {
      const msg = `Azure is not configured: ${errMsg}. Add the missing variable to your Netlify environment variables.`
      await createMessage(sessionId, 'assistant', msg)
      return Response.json(
        { assistantMessage: msg, userMessageId: userMsg.id, assistantMessageId: '', sessionTitle },
        { status: 500 }
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
