'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Sidebar, { Session } from '@/components/Sidebar'
import ChatArea from '@/components/ChatArea'
import RightPanel, { Step } from '@/components/RightPanel'

interface Message {
  id?: string
  role: 'user' | 'assistant'
  content: string
  created_at?: string
}

function ChatPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('sessionId') ?? ''

  const [userId, setUserId] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [sessions, setSessions] = useState<Session[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [composerValue, setComposerValue] = useState('')

  // File state owned here (never in FileUpload component)
  const [contractText, setContractText] = useState('')
  const [contractFilename, setContractFilename] = useState('')
  const [previewUrl, setPreviewUrl] = useState('')
  const [fileType, setFileType] = useState('')

  // Execution steps
  const [steps, setSteps] = useState<Step[]>([])
  // API-key auth — always connected when env vars are set
  const azureConnected = true

  // Auth guard + init
  useEffect(() => {
    const id = localStorage.getItem('userId')
    const email = localStorage.getItem('userEmail')
    if (!id) {
      router.replace('/login')
      return
    }
    setUserId(id)
    setUserEmail(email ?? '')
    fetchSessions(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load messages when sessionId changes
  useEffect(() => {
    if (!sessionId) return
    setMessages([]) // clear immediately to prevent stale flash
    setSteps([])
    fetchMessages(sessionId)
  }, [sessionId])

  async function fetchSessions(uid: string) {
    const res = await fetch(`/api/sessions?userId=${uid}`)
    if (res.ok) setSessions(await res.json())
  }

  async function fetchMessages(sid: string) {
    const res = await fetch(`/api/messages?sessionId=${sid}`)
    if (res.ok) setMessages(await res.json())
  }

  async function handleNewChat() {
    const uid = userId || localStorage.getItem('userId') || ''
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: uid, title: 'New session' }),
    })
    if (res.ok) {
      const session = await res.json()
      setSessions((prev) => [session, ...prev])
      router.push(`/chat?sessionId=${session.id}`)
    }
  }

  function handleSelectSession(id: string) {
    router.push(`/chat?sessionId=${id}`)
  }

  async function handleRename(id: string, title: string) {
    await fetch(`/api/sessions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    })
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, title } : s)))
  }

  async function handlePin(id: string, pinned: boolean) {
    await fetch(`/api/sessions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pinned }),
    })
    setSessions((prev) =>
      [...prev.map((s) => (s.id === id ? { ...s, pinned } : s))].sort(
        (a, b) => Number(b.pinned) - Number(a.pinned)
      )
    )
  }

  async function handleDelete(id: string) {
    await fetch(`/api/sessions/${id}`, { method: 'DELETE' })
    setSessions((prev) => prev.filter((s) => s.id !== id))
    if (id === sessionId) {
      setMessages([])
      router.push('/dashboard')
    }
  }

  function handleFileLoaded(text: string, filename: string, url: string, type: string) {
    setContractText(text)
    setContractFilename(filename)
    setPreviewUrl(url)
    setFileType(type)
  }

  function handleFileClear() {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setContractText('')
    setContractFilename('')
    setPreviewUrl('')
    setFileType('')
  }

  async function handleSend() {
    if (!composerValue.trim() || isLoading || !sessionId) return

    const userMsg: Message = {
      role: 'user',
      content: composerValue,
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, userMsg])
    setComposerValue('')
    setIsLoading(true)

    // Animate execution steps
    setSteps([
      { label: 'Parsing document', status: contractText ? 'done' : 'pending' },
      { label: 'Sending to Azure AI', status: 'active' },
      { label: 'Waiting for response', status: 'pending' },
      { label: 'Completed', status: 'pending' },
    ])

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          userMessage: composerValue,
          contractText: contractText || undefined,
        }),
      })

      setSteps([
        { label: 'Parsing document', status: contractText ? 'done' : 'pending' },
        { label: 'Sending to Azure AI', status: 'done' },
        { label: 'Waiting for response', status: 'active' },
        { label: 'Completed', status: 'pending' },
      ])

      const data = await res.json()

      if (res.status === 401 || res.status === 403) {
        const errMsg: Message = {
          role: 'assistant',
          content: data.error ?? 'Azure authentication failed. Check your AZURE_API_KEY.',
          created_at: new Date().toISOString(),
        }
        setMessages((prev) => [...prev, errMsg])
        setSteps((prev) => prev.map((s) => ({ ...s, status: 'error' as const })))
        return
      }

      if (data.assistantMessage) {
        setMessages((prev) => [
          ...prev,
          {
            id: data.assistantMessageId,
            role: 'assistant',
            content: data.assistantMessage,
            created_at: new Date().toISOString(),
          },
        ])
      }

      // Update session title in sidebar if it was auto-renamed
      if (data.sessionTitle) {
        setSessions((prev) =>
          prev.map((s) => (s.id === sessionId ? { ...s, title: data.sessionTitle } : s))
        )
      }

      setSteps([
        { label: 'Parsing document', status: contractText ? 'done' : 'pending' },
        { label: 'Sending to Azure AI', status: 'done' },
        { label: 'Waiting for response', status: 'done' },
        { label: 'Completed', status: 'done' },
      ])
    } catch {
      const errMsg: Message = {
        role: 'assistant',
        content: 'Something went wrong. Please try again.',
        created_at: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, errMsg])
      setSteps((prev) =>
        prev.map((s) => (s.status !== 'done' ? { ...s, status: 'error' as const } : s))
      )
    } finally {
      setIsLoading(false)
    }
  }

  if (!sessionId) {
    return (
      <div className="flex h-screen items-center justify-center bg-an-bg-base">
        <p className="text-an-fg-muted text-sm">No session selected</p>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-an-bg-base">
      <Sidebar
        sessions={sessions}
        activeSessionId={sessionId}
        userId={userId}
        userEmail={userEmail}
        onNewChat={handleNewChat}
        onSelectSession={handleSelectSession}
        onRenameSession={handleRename}
        onPinSession={handlePin}
        onDeleteSession={handleDelete}
      />

      <ChatArea
        messages={messages}
        isLoading={isLoading}
        userId={userId}
        sessionId={sessionId}
        composerValue={composerValue}
        onComposerChange={setComposerValue}
        onSend={handleSend}
        filename={contractFilename}
        onFileLoaded={handleFileLoaded}
        onFileClear={handleFileClear}
      />

      <RightPanel
        steps={steps}
        previewUrl={previewUrl}
        fileType={fileType}
        contractText={contractText}
        filename={contractFilename}
        azureConnected={azureConnected}
      />
    </div>
  )
}

export default function ChatPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-an-bg-base">
          <span className="text-an-fg-muted text-sm">Loading...</span>
        </div>
      }
    >
      <ChatPageInner />
    </Suspense>
  )
}
