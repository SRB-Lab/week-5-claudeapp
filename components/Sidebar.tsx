'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus,
  Search,
  Pin,
  Trash2,
  Pencil,
  MoreHorizontal,
  Loader2,
  CheckCircle,
  XCircle,
  Minus,
  LogOut,
} from 'lucide-react'

export interface Session {
  id: string
  title: string
  status: 'idle' | 'processing' | 'completed' | 'error'
  pinned: boolean
  created_at: string
  updated_at: string
}

interface SidebarProps {
  sessions: Session[]
  activeSessionId?: string
  userId: string
  userEmail: string
  onNewChat: () => void
  onSelectSession: (id: string) => void
  onRenameSession: (id: string, title: string) => void
  onPinSession: (id: string, pinned: boolean) => void
  onDeleteSession: (id: string) => void
}

type FilterTab = 'all' | 'pinned' | 'recent' | 'processing' | 'completed' | 'error'

function StatusIcon({ status }: { status: Session['status'] }) {
  if (status === 'processing')
    return <Loader2 size={12} className="text-an-warning animate-spin shrink-0" />
  if (status === 'completed')
    return <CheckCircle size={12} className="text-an-success shrink-0" />
  if (status === 'error')
    return <XCircle size={12} className="text-an-error shrink-0" />
  return <Minus size={12} className="text-an-fg-muted shrink-0" />
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  if (isToday) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export default function Sidebar({
  sessions,
  activeSessionId,
  userId,
  userEmail,
  onNewChat,
  onSelectSession,
  onRenameSession,
  onPinSession,
  onDeleteSession,
}: SidebarProps) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<FilterTab>('all')
  const [contextMenu, setContextMenu] = useState<{ sessionId: string; x: number; y: number } | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const today = new Date()
  const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)

  const filtered = sessions.filter((s) => {
    const matchesQuery = s.title.toLowerCase().includes(query.toLowerCase())
    if (!matchesQuery) return false
    if (filter === 'all') return true
    if (filter === 'pinned') return s.pinned
    if (filter === 'recent') return new Date(s.updated_at) >= sevenDaysAgo
    return s.status === filter
  })

  function handleLogout() {
    localStorage.clear()
    router.push('/login')
  }

  function startRename(session: Session) {
    setRenamingId(session.id)
    setRenameValue(session.title)
    setContextMenu(null)
  }

  function commitRename(id: string) {
    if (renameValue.trim()) onRenameSession(id, renameValue.trim())
    setRenamingId(null)
  }

  const filterTabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'pinned', label: 'Pinned' },
    { key: 'recent', label: 'Recent' },
    { key: 'processing', label: 'Processing' },
    { key: 'completed', label: 'Completed' },
    { key: 'error', label: 'Error' },
  ]

  return (
    <aside className="w-64 shrink-0 h-screen flex flex-col bg-an-bg-subtle border-r border-an-border">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-an-border">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-an-accent shrink-0" />
          <span className="text-[13px] font-medium text-an-fg-base truncate">
            Legal Contract Analyzer
          </span>
        </div>
      </div>

      {/* New chat */}
      <div className="px-3 pt-3">
        <button
          onClick={onNewChat}
          className="w-full h-9 flex items-center justify-center gap-2 bg-an-accent hover:bg-an-accent-hover text-white rounded-md text-sm font-medium transition-colors duration-150"
        >
          <Plus size={14} />
          New chat
        </button>
      </div>

      {/* Search */}
      <div className="px-3 pt-2">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-an-fg-muted" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search sessions..."
            className="w-full h-8 pl-8 pr-3 bg-an-bg-surface border border-an-border rounded-md text-[13px] text-an-fg-base placeholder:text-an-fg-muted focus:outline-none focus:border-an-border-strong transition-colors"
          />
        </div>
      </div>

      {/* Filter tabs */}
      <div className="px-3 pt-2 flex flex-wrap gap-1">
        {filterTabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={`h-5 px-2 rounded-full text-[11px] font-medium transition-colors duration-100 ${
              filter === t.key
                ? 'bg-an-accent-subtle text-an-accent'
                : 'bg-an-bg-surface text-an-fg-muted hover:text-an-fg-subtle'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5">
        {filtered.length === 0 && (
          <p className="text-[12px] text-an-fg-muted px-3 py-4 text-center">No sessions found</p>
        )}
        {filtered.map((s) => (
          <div key={s.id} className="relative group">
            {renamingId === s.id ? (
              <input
                autoFocus
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={() => commitRename(s.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename(s.id)
                  if (e.key === 'Escape') setRenamingId(null)
                }}
                className="w-full h-9 px-3 bg-an-bg-elevated border border-an-border-strong rounded-md text-[13px] text-an-fg-base focus:outline-none"
              />
            ) : (
              <button
                onClick={() => onSelectSession(s.id)}
                className={`w-full h-9 flex items-center gap-2 px-3 rounded-md text-left transition-colors duration-100 ${
                  activeSessionId === s.id
                    ? 'bg-an-bg-elevated text-an-fg-base'
                    : 'text-an-fg-subtle hover:bg-an-bg-surface hover:text-an-fg-base'
                }`}
              >
                <StatusIcon status={s.status} />
                {s.pinned && <Pin size={10} className="text-an-accent shrink-0" />}
                <span className="flex-1 truncate text-[13px]">{s.title}</span>
                <span className="text-[11px] text-an-fg-muted shrink-0 group-hover:hidden">
                  {formatDate(s.updated_at)}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setContextMenu({ sessionId: s.id, x: 0, y: 0 })
                  }}
                  className="hidden group-hover:flex items-center justify-center w-5 h-5 rounded hover:bg-an-bg-elevated text-an-fg-muted hover:text-an-fg-base shrink-0"
                >
                  <MoreHorizontal size={13} />
                </button>
              </button>
            )}

            {/* Context menu */}
            {contextMenu?.sessionId === s.id && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setContextMenu(null)}
                />
                <div className="absolute right-0 top-9 z-20 w-40 bg-an-bg-elevated border border-an-border rounded-md shadow-lg py-1 an-fade-in">
                  <button
                    onClick={() => startRename(s)}
                    className="w-full flex items-center gap-2 px-3 h-8 text-[13px] text-an-fg-subtle hover:text-an-fg-base hover:bg-an-bg-surface transition-colors"
                  >
                    <Pencil size={13} />
                    Rename
                  </button>
                  <button
                    onClick={() => {
                      onPinSession(s.id, !s.pinned)
                      setContextMenu(null)
                    }}
                    className="w-full flex items-center gap-2 px-3 h-8 text-[13px] text-an-fg-subtle hover:text-an-fg-base hover:bg-an-bg-surface transition-colors"
                  >
                    <Pin size={13} />
                    {s.pinned ? 'Unpin' : 'Pin'}
                  </button>
                  <div className="my-1 border-t border-an-border" />
                  <button
                    onClick={() => {
                      onDeleteSession(s.id)
                      setContextMenu(null)
                    }}
                    className="w-full flex items-center gap-2 px-3 h-8 text-[13px] text-an-error hover:bg-an-bg-surface transition-colors"
                  >
                    <Trash2 size={13} />
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* User footer */}
      <div className="px-3 py-3 border-t border-an-border">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-an-bg-elevated flex items-center justify-center shrink-0">
            <span className="text-[11px] font-medium text-an-fg-subtle uppercase">
              {userEmail?.[0] ?? 'U'}
            </span>
          </div>
          <span className="flex-1 text-[12px] text-an-fg-subtle truncate">{userEmail}</span>
          <button
            onClick={handleLogout}
            title="Sign out"
            className="flex items-center justify-center w-7 h-7 rounded hover:bg-an-bg-surface text-an-fg-muted hover:text-an-fg-base transition-colors shrink-0"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  )
}
