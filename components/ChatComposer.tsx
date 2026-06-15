'use client'

import { useRef, useEffect, KeyboardEvent } from 'react'
import { Send } from 'lucide-react'
import FileUpload from './FileUpload'

interface ChatComposerProps {
  value: string
  onChange: (v: string) => void
  onSend: () => void
  isLoading: boolean
  filename: string
  onFileLoaded: (text: string, filename: string, previewUrl: string, fileType: string) => void
  onFileClear: () => void
}

export default function ChatComposer({
  value,
  onChange,
  onSend,
  isLoading,
  filename,
  onFileLoaded,
  onFileClear,
}: ChatComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-expand textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 200) + 'px'
  }, [value])

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!isLoading && value.trim()) onSend()
    }
  }

  const canSend = !isLoading && value.trim().length > 0

  return (
    <div className="border-t border-an-border bg-an-bg-base px-6 py-4">
      <div className="max-w-[680px] mx-auto">
        <div
          className="flex flex-col gap-2 bg-an-bg-surface border border-an-border rounded-xl px-4 pt-3 pb-3"
          style={{ borderColor: 'var(--an-border-base)' }}
        >
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question about your contract..."
            disabled={isLoading}
            rows={1}
            className="w-full bg-transparent text-sm text-an-fg-base placeholder:text-an-fg-muted focus:outline-none resize-none leading-relaxed disabled:opacity-50"
            style={{ minHeight: '24px', maxHeight: '200px' }}
          />
          <div className="flex items-center justify-between">
            <FileUpload
              filename={filename}
              onFileLoaded={onFileLoaded}
              onClear={onFileClear}
            />
            <button
              onClick={onSend}
              disabled={!canSend}
              className="w-8 h-8 rounded-full bg-an-accent hover:bg-an-accent-hover flex items-center justify-center transition-colors duration-150 disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
            >
              <Send size={14} className="text-white" strokeWidth={1.5} />
            </button>
          </div>
        </div>
        <p className="text-[11px] text-an-fg-muted mt-2 text-center">
          AI-generated analysis only. Consult a qualified legal professional before acting on this information.
        </p>
      </div>
    </div>
  )
}
