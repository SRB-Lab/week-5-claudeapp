'use client'

import FeedbackWidget from './FeedbackWidget'

interface Message {
  id?: string
  role: 'user' | 'assistant'
  content: string
  created_at?: string
}

interface MessageBubbleProps {
  message: Message
  userId: string
  sessionId: string
  isLast: boolean
}

function formatTime(dateStr?: string) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  if (isToday) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
    ' ' +
    d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function MessageBubble({ message, userId, sessionId, isLast }: MessageBubbleProps) {
  const isUser = message.role === 'user'

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[75%]">
          <div
            className="px-4 py-3 text-sm text-an-fg-base leading-relaxed"
            style={{
              background: 'var(--an-accent-subtle)',
              border: '1px solid rgba(217,119,87,0.20)',
              borderRadius: '12px 12px 4px 12px',
            }}
          >
            {message.content}
          </div>
          {message.created_at && (
            <p className="text-[11px] text-an-fg-muted mt-1 text-right">
              {formatTime(message.created_at)}
            </p>
          )}
        </div>
      </div>
    )
  }

  // Assistant message
  return (
    <div className="flex flex-col">
      <div className="flex items-start gap-2">
        <div className="w-2 h-2 rounded-full bg-an-accent mt-2 shrink-0" />
        <div className="flex-1">
          <p className="text-sm text-an-fg-base leading-relaxed whitespace-pre-wrap">
            {message.content}
          </p>
          {message.created_at && (
            <p className="text-[11px] text-an-fg-muted mt-1">
              {formatTime(message.created_at)}
            </p>
          )}
          {isLast && (
            <FeedbackWidget userId={userId} sessionId={sessionId} />
          )}
        </div>
      </div>
    </div>
  )
}
