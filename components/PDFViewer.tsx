'use client'

interface PDFViewerProps {
  blobUrl: string
  filename: string
}

export default function PDFViewer({ blobUrl }: PDFViewerProps) {
  return (
    <iframe
      src={blobUrl}
      className="w-full h-full border-0"
      title="PDF preview"
    />
  )
}
