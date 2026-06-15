'use client'

import { useEffect, useRef } from 'react'
import MessageBubble from './MessageBubble'

interface Message {
  id?: string
  role: 'user' | 'assistant'
  content: string
  created_at?: string
}

interface MessageListProps {
  messages: Message[]
  userId: string
  sessionId: string
  isLoading: boolean
}

export default function MessageList({ messages, userId, sessionId, isLoading }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  if (messages.length === 0 && !isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-[14px] text-an-fg-muted text-center max-w-xs leading-relaxed">
          Upload a contract and ask your first question
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto py-6">
      <div className="max-w-[680px] mx-auto px-6 space-y-6">
        {messages.map((msg, i) => (
          <MessageBubble
            key={msg.id ?? i}
            message={msg}
            userId={userId}
            sessionId={sessionId}
            isLast={msg.role === 'assistant' && i === messages.length - 1}
          />
        ))}

        {isLoading && (
          <div className="flex items-start gap-2">
            <div className="w-2 h-2 rounded-full bg-an-accent mt-2 shrink-0" />
            <div className="flex gap-1 pt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-an-fg-muted animate-bounce [animation-delay:0ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-an-fg-muted animate-bounce [animation-delay:150ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-an-fg-muted animate-bounce [animation-delay:300ms]" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  )
}
