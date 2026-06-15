'use client'

import MessageList from './MessageList'
import ChatComposer from './ChatComposer'

interface Message {
  id?: string
  role: 'user' | 'assistant'
  content: string
  created_at?: string
}

interface ChatAreaProps {
  messages: Message[]
  isLoading: boolean
  userId: string
  sessionId: string
  composerValue: string
  onComposerChange: (v: string) => void
  onSend: () => void
  filename: string
  onFileLoaded: (text: string, filename: string, previewUrl: string, fileType: string) => void
  onFileClear: () => void
}

export default function ChatArea({
  messages,
  isLoading,
  userId,
  sessionId,
  composerValue,
  onComposerChange,
  onSend,
  filename,
  onFileLoaded,
  onFileClear,
}: ChatAreaProps) {
  return (
    <div className="flex-1 flex flex-col h-screen min-w-0 bg-an-bg-base overflow-hidden">
      <MessageList
        messages={messages}
        userId={userId}
        sessionId={sessionId}
        isLoading={isLoading}
      />
      <ChatComposer
        value={composerValue}
        onChange={onComposerChange}
        onSend={onSend}
        isLoading={isLoading}
        filename={filename}
        onFileLoaded={onFileLoaded}
        onFileClear={onFileClear}
      />
    </div>
  )
}
