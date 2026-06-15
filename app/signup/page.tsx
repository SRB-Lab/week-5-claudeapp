'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function SignupPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong')
        return
      }
      localStorage.setItem('userId', data.id)
      localStorage.setItem('userEmail', data.email)
      router.push('/dashboard')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div data-theme="light" className="min-h-screen bg-an-bg-base flex items-center justify-center p-6">
      <div className="w-full max-w-[400px]">
        <div className="text-center mb-8">
          <div className="w-8 h-8 rounded-full bg-an-accent mx-auto mb-4" />
          <h1 className="font-display text-[28px] font-medium text-an-fg-base mb-1">
            Legal Contract Analyzer
          </h1>
          <p className="text-an-fg-subtle text-sm">Create your account</p>
        </div>

        <div className="bg-an-bg-subtle border border-an-border rounded-lg p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[12px] font-medium text-an-fg-base mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full h-9 px-3 bg-an-bg-surface border border-an-border rounded-md text-sm text-an-fg-base placeholder:text-an-fg-muted focus:outline-none focus:border-an-border-strong transition-colors"
              />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-an-fg-base mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                required
                className="w-full h-9 px-3 bg-an-bg-surface border border-an-border rounded-md text-sm text-an-fg-base placeholder:text-an-fg-muted focus:outline-none focus:border-an-border-strong transition-colors"
              />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-an-fg-base mb-1.5">
                Confirm password
              </label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full h-9 px-3 bg-an-bg-surface border border-an-border rounded-md text-sm text-an-fg-base placeholder:text-an-fg-muted focus:outline-none focus:border-an-border-strong transition-colors"
              />
            </div>

            {error && <p className="text-[13px] text-an-error">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-9 bg-an-accent hover:bg-an-accent-hover text-white rounded-md text-sm font-medium transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-an-fg-subtle mt-4">
          Already have an account?{' '}
          <Link href="/login" className="text-an-accent hover:text-an-accent-hover transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
