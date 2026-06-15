import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-an-bg-base px-6">
      <div className="text-center max-w-lg">
        <div className="w-10 h-10 rounded-full bg-an-accent mx-auto mb-8" />

        <h1 className="font-display text-[28px] font-medium text-an-fg-base mb-3 leading-snug">
          Legal Contract Analyzer
        </h1>
        <p className="text-an-fg-subtle text-[14px] leading-relaxed mb-8">
          Upload a contract, ask questions in plain English, and get clear analysis powered by Azure AI.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/login"
            className="inline-flex items-center justify-center h-9 px-4 rounded-md bg-an-accent text-white text-[14px] font-medium hover:bg-an-accent-hover transition-colors duration-150"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="inline-flex items-center justify-center h-9 px-4 rounded-md border border-an-border text-an-fg-base text-[14px] hover:bg-an-bg-surface transition-colors duration-150"
          >
            Create account
          </Link>
        </div>
      </div>
    </main>
  )
}
