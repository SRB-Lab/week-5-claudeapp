'use client'

import { useRef, useState } from 'react'
import { Paperclip, X, AlertCircle } from 'lucide-react'

interface FileUploadProps {
  filename: string
  onFileLoaded: (text: string, filename: string, previewUrl: string, fileType: string) => void
  onClear: () => void
}

const MAX_SIZE = 10 * 1024 * 1024 // 10 MB

export default function FileUpload({ filename, onFileLoaded, onClear }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState('')
  const [parsing, setParsing] = useState(false)

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!inputRef.current) return
    inputRef.current.value = ''

    if (!file) return
    setError('')

    if (file.size > MAX_SIZE) {
      setError('File must be under 10 MB')
      return
    }

    const isPdf = file.type === 'application/pdf'
    const isDocx =
      file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

    if (!isPdf && !isDocx) {
      setError('Only PDF and DOCX files are supported')
      return
    }

    setParsing(true)
    try {
      if (isPdf) {
        const blobUrl = URL.createObjectURL(file)
        const arrayBuffer = await file.arrayBuffer()

        // Dynamic import to avoid SSR issues
        const pdfjsLib = await import('pdfjs-dist')
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
        let text = ''
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i)
          const content = await page.getTextContent()
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          text += content.items.map((item: any) => item.str ?? '').join(' ') + '\n'
        }

        if (text.trim().length === 0) {
          URL.revokeObjectURL(blobUrl)
          setError('This PDF appears to be scanned (no text found). Please use a text-based PDF.')
          return
        }

        onFileLoaded(text, file.name, blobUrl, file.type)
      } else {
        // DOCX
        const arrayBuffer = await file.arrayBuffer()
        const mammoth = await import('mammoth')
        const result = await mammoth.extractRawText({ arrayBuffer })
        onFileLoaded(result.value, file.name, '', file.type)
      }
    } catch {
      setError('Failed to parse the file. Please try another file.')
    } finally {
      setParsing(false)
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx"
        onChange={handleChange}
        className="hidden"
      />

      {filename ? (
        <div className="flex items-center gap-1.5 h-7 px-2.5 bg-an-accent-subtle border border-an-accent/20 rounded-full text-[12px] text-an-accent">
          <Paperclip size={11} strokeWidth={1.5} />
          <span className="max-w-[140px] truncate">{filename}</span>
          <button
            onClick={onClear}
            className="hover:text-an-accent-hover transition-colors ml-0.5"
          >
            <X size={11} />
          </button>
        </div>
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          disabled={parsing}
          title="Attach PDF or DOCX"
          className="flex items-center justify-center w-8 h-8 rounded-full text-an-fg-muted hover:text-an-fg-base hover:bg-an-bg-elevated transition-colors disabled:opacity-50"
        >
          {parsing ? (
            <span className="w-3 h-3 border border-an-fg-muted border-t-transparent rounded-full animate-spin" />
          ) : (
            <Paperclip size={16} strokeWidth={1.5} />
          )}
        </button>
      )}

      {error && (
        <div className="flex items-center gap-1.5 mt-1.5 text-[12px] text-an-error">
          <AlertCircle size={12} />
          {error}
        </div>
      )}
    </div>
  )
}
