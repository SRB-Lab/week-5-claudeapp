'use client'

import { useState } from 'react'
import { Star } from 'lucide-react'

interface FeedbackWidgetProps {
  userId: string
  sessionId: string
}

export default function FeedbackWidget({ userId, sessionId }: FeedbackWidgetProps) {
  const [rating, setRating] = useState(0)
  const [hover, setHover] = useState(0)
  const [comment, setComment] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    if (!rating) return
    setLoading(true)
    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, sessionId, rating, comment: comment || undefined }),
      })
      setSubmitted(true)
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <p className="text-[12px] text-an-fg-muted mt-2">Thanks for your feedback</p>
    )
  }

  return (
    <div className="mt-3 space-y-2">
      {/* Stars */}
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(0)}
            onClick={() => setRating(star)}
            className="transition-colors duration-100"
          >
            <Star
              size={14}
              className={
                star <= (hover || rating)
                  ? 'text-an-accent fill-an-accent'
                  : 'text-an-fg-muted'
              }
              strokeWidth={1.5}
            />
          </button>
        ))}
        {rating > 0 && (
          <span className="text-[11px] text-an-fg-muted ml-1">{rating}/5</span>
        )}
      </div>

      {rating > 0 && (
        <>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={500}
            placeholder="Optional comment..."
            rows={2}
            className="w-full px-3 py-2 bg-an-bg-surface border border-an-border rounded-md text-[13px] text-an-fg-base placeholder:text-an-fg-muted focus:outline-none focus:border-an-border-strong resize-none transition-colors"
          />
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="h-7 px-3 bg-an-accent hover:bg-an-accent-hover text-white rounded-md text-[12px] font-medium transition-colors duration-150 disabled:opacity-50"
          >
            {loading ? 'Submitting...' : 'Submit feedback'}
          </button>
        </>
      )}
    </div>
  )
}
