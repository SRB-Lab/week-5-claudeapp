'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar, { Session } from '@/components/Sidebar'
import RightPanel from '@/components/RightPanel'
import {
  MessageSquare,
  Pin,
  CheckCircle,
  AlertCircle,
  Loader2,
  Clock,
  BarChart2,
} from 'lucide-react'

interface KpiCard {
  label: string
  value: number | string
  icon: React.ReactNode
  sub?: string
}

export default function DashboardPage() {
  const router = useRouter()
  const [userId, setUserId] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)

  // Auth guard
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

  async function fetchSessions(uid: string) {
    setLoading(true)
    const res = await fetch(`/api/sessions?userId=${uid}`)
    if (res.ok) setSessions(await res.json())
    setLoading(false)
  }

  async function handleNewChat() {
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, title: 'New session' }),
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
  }

  // KPI derivations
  const today = new Date().toDateString()
  const kpis: KpiCard[] = [
    {
      label: 'Total sessions',
      value: sessions.length,
      icon: <MessageSquare size={16} className="text-an-accent" />,
    },
    {
      label: 'Sessions today',
      value: sessions.filter((s) => new Date(s.created_at).toDateString() === today).length,
      icon: <Clock size={16} className="text-an-accent" />,
      sub: 'created today',
    },
    {
      label: 'Completed',
      value: sessions.filter((s) => s.status === 'completed').length,
      icon: <CheckCircle size={16} className="text-an-success" />,
    },
    {
      label: 'Pinned',
      value: sessions.filter((s) => s.pinned).length,
      icon: <Pin size={16} className="text-an-accent" />,
    },
    {
      label: 'Processing',
      value: sessions.filter((s) => s.status === 'processing').length,
      icon: <Loader2 size={16} className="text-an-warning" />,
    },
    {
      label: 'Failed',
      value: sessions.filter((s) => s.status === 'error').length,
      icon: <AlertCircle size={16} className="text-an-error" />,
    },
  ]

  const recentSessions = sessions.slice(0, 5)

  return (
    <div className="flex h-screen overflow-hidden bg-an-bg-base">
      <Sidebar
        sessions={sessions}
        userId={userId}
        userEmail={userEmail}
        onNewChat={handleNewChat}
        onSelectSession={handleSelectSession}
        onRenameSession={handleRename}
        onPinSession={handlePin}
        onDeleteSession={handleDelete}
      />

      {/* Center */}
      <main className="flex-1 overflow-y-auto px-8 py-8">
        <div className="max-w-3xl mx-auto">
          <div className="mb-8">
            <h1 className="text-[20px] font-medium text-an-fg-base mb-1">Dashboard</h1>
            <p className="text-[14px] text-an-fg-subtle">
              Welcome back{userEmail ? `, ${userEmail.split('@')[0]}` : ''}
            </p>
          </div>

          {/* KPI grid */}
          {loading ? (
            <div className="grid grid-cols-3 gap-4 mb-8">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-24 bg-an-bg-surface border border-an-border rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4 mb-8">
              {kpis.map((k) => (
                <div
                  key={k.label}
                  className="bg-an-bg-surface border border-an-border rounded-lg p-4"
                >
                  <div className="flex items-center gap-2 mb-2">
                    {k.icon}
                    <span className="text-[12px] text-an-fg-muted">{k.label}</span>
                  </div>
                  <p className="text-[28px] font-medium text-an-fg-base leading-none">{k.value}</p>
                  {k.sub && <p className="text-[11px] text-an-fg-muted mt-1">{k.sub}</p>}
                </div>
              ))}
            </div>
          )}

          {/* Recent sessions */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <BarChart2 size={14} className="text-an-fg-muted" />
              <h2 className="text-[14px] font-medium text-an-fg-base">Recent sessions</h2>
            </div>

            {!loading && sessions.length === 0 && (
              <div className="bg-an-bg-surface border border-an-border rounded-lg p-8 text-center">
                <p className="text-[14px] text-an-fg-muted mb-4">No sessions yet</p>
                <button
                  onClick={handleNewChat}
                  className="h-9 px-4 bg-an-accent hover:bg-an-accent-hover text-white rounded-md text-sm font-medium transition-colors duration-150"
                >
                  Start your first chat
                </button>
              </div>
            )}

            <div className="space-y-2">
              {recentSessions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => handleSelectSession(s.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-an-bg-surface border border-an-border rounded-lg hover:border-an-border-strong text-left transition-colors duration-100"
                >
                  <div
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      s.status === 'completed'
                        ? 'bg-an-success'
                        : s.status === 'error'
                        ? 'bg-an-error'
                        : s.status === 'processing'
                        ? 'bg-an-warning'
                        : 'bg-an-fg-muted'
                    }`}
                  />
                  <span className="flex-1 text-[14px] text-an-fg-base truncate">{s.title}</span>
                  {s.pinned && <Pin size={12} className="text-an-accent shrink-0" />}
                  <span className="text-[12px] text-an-fg-muted shrink-0">
                    {new Date(s.updated_at).toLocaleDateString([], {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>

      <RightPanel
        steps={[]}
        previewUrl=""
        fileType=""
        contractText=""
        filename=""
        azureConnected={false}
      />
    </div>
  )
}
