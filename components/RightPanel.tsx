'use client'

import { CheckCircle, XCircle, Loader2, Circle, FileText, Link } from 'lucide-react'
import PDFViewer from './PDFViewer'

export type StepStatus = 'pending' | 'active' | 'done' | 'error'

export interface Step {
  label: string
  status: StepStatus
}

interface RightPanelProps {
  steps: Step[]
  previewUrl: string
  fileType: string
  contractText: string
  filename: string
  azureConnected: boolean
}

function StepIcon({ status }: { status: StepStatus }) {
  if (status === 'active') return <Loader2 size={14} className="text-an-accent animate-spin" />
  if (status === 'done') return <CheckCircle size={14} className="text-an-success" />
  if (status === 'error') return <XCircle size={14} className="text-an-error" />
  return <Circle size={14} className="text-an-fg-muted" />
}

export default function RightPanel({
  steps,
  previewUrl,
  fileType,
  contractText,
  filename,
  azureConnected,
}: RightPanelProps) {
  const hasFile = !!previewUrl || !!contractText

  return (
    <aside className="w-[304px] shrink-0 h-screen flex flex-col bg-an-bg-subtle border-l border-an-border">
      {/* Document preview */}
      <div className="flex-1 min-h-0 flex flex-col border-b border-an-border overflow-hidden">
        <div className="px-4 py-3 flex items-center gap-2 border-b border-an-border shrink-0">
          <FileText size={14} className="text-an-fg-muted" />
          <span className="text-[12px] font-medium text-an-fg-subtle uppercase tracking-wide">
            Document preview
          </span>
        </div>

        <div className="flex-1 min-h-0 overflow-hidden">
          {!hasFile && (
            <div className="h-full flex items-center justify-center px-6">
              <p className="text-[13px] text-an-fg-muted text-center leading-relaxed">
                Upload a document to see a preview
              </p>
            </div>
          )}

          {hasFile && fileType === 'application/pdf' && previewUrl && (
            <PDFViewer blobUrl={previewUrl} filename={filename} />
          )}

          {hasFile && fileType !== 'application/pdf' && contractText && (
            <div className="h-full overflow-y-auto p-4">
              <pre className="text-[12px] font-mono text-an-fg-subtle whitespace-pre-wrap break-words leading-relaxed">
                {contractText.slice(0, 4000)}
                {contractText.length > 4000 && (
                  <span className="text-an-fg-muted italic">{'\n\n…(preview truncated)'}</span>
                )}
              </pre>
            </div>
          )}
        </div>
      </div>

      {/* Execution steps */}
      <div className="shrink-0 p-4">
        <p className="text-[12px] font-medium text-an-fg-subtle uppercase tracking-wide mb-3">
          Execution steps
        </p>

        {steps.length === 0 ? (
          <p className="text-[13px] text-an-fg-muted">No activity yet</p>
        ) : (
          <div className="space-y-2">
            {steps.map((step, i) => (
              <div key={i} className="flex items-center gap-2">
                <StepIcon status={step.status} />
                <span
                  className={`text-[13px] ${
                    step.status === 'pending'
                      ? 'text-an-fg-muted'
                      : step.status === 'error'
                      ? 'text-an-error'
                      : 'text-an-fg-subtle'
                  }`}
                >
                  {step.label}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Azure connection status */}
        <div className="mt-4 pt-4 border-t border-an-border">
          <div className="flex items-center gap-2 mb-2">
            <div
              className={`w-2 h-2 rounded-full ${azureConnected ? 'bg-an-success' : 'bg-an-fg-muted'}`}
            />
            <span className="text-[12px] text-an-fg-muted">
              {azureConnected ? 'Azure AI connected' : 'Azure AI not connected'}
            </span>
          </div>
          {!azureConnected && (
            <a
              href="/api/auth/microsoft"
              className="inline-flex items-center gap-1.5 h-7 px-3 bg-an-bg-surface border border-an-border rounded-md text-[12px] text-an-fg-subtle hover:text-an-fg-base hover:border-an-border-strong transition-colors"
            >
              <Link size={11} />
              Connect with Microsoft
            </a>
          )}
        </div>
      </div>
    </aside>
  )
}
