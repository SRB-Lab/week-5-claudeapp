# File Upload Spec — Legal Document Analyzer

## Feature Name
Document Upload and Preview

---

## Description

Users attach a PDF or DOCX file to the chat by clicking the paperclip icon in the composer. The file is parsed **entirely client-side** in the browser before any data is sent to the server. Only the extracted plain text is transmitted — the raw file is never sent to the backend and never stored on the server. File state (text, filename, preview URL, file type) is owned by the chat page, not by the FileUpload component. The parsed text is included in every subsequent POST `/api/chat` call within the session.

---

## User Flow

1. User clicks paperclip icon (`Paperclip`, 16px) in the ChatComposer
2. Hidden `<input type="file" accept=".pdf,.docx">` is triggered programmatically
3. File picker opens; user selects a file
4. Client validates: type (PDF or DOCX only) and size (≤ 10 MB)
   - Invalid type → show error "Only PDF and DOCX files are supported"
   - Too large → show error "File must be under 10 MB"
5. Parsing spinner replaces paperclip icon
6. PDF parsing: `pdfjs-dist` extracts text page-by-page; blob URL created for preview
7. DOCX parsing: `mammoth.extractRawText({ arrayBuffer })`
8. If PDF yields zero text: blocked with "This PDF appears to be scanned (no text found). Please use a text-based PDF."
9. On success: `onFileLoaded(text, filename, previewUrl, fileType)` called
10. Composer shows filename chip (coral, with dismiss X)
11. Right panel shows PDF iframe preview (PDF) or `<pre>` text preview (DOCX)
12. User sends a message — `contractText` is included in the request body
13. File persists across multiple messages in the session
14. User dismisses file: X on chip → `onFileClear()` → blob URL revoked → all file state cleared

---

## How Content Reaches the Backend

The extracted plain text (`contractText`) is sent as a JSON field in the POST `/api/chat` body:

```json
{
  "sessionId": "uuid",
  "userMessage": "What does section 4.2 say?",
  "contractText": "...full extracted text string..."
}
```

- Field name: `contractText`
- Type: `string`
- Max length: no hard limit in MVP; Azure context window limits apply (~80k tokens)
- When no file attached: field is omitted from the request body (`contractText: undefined`)
- The raw file bytes are never sent anywhere

---

## Parsing Strategy

All parsing is **client-side** (in the browser). Dynamic imports are used to avoid SSR issues.

### PDF — `pdfjs-dist` v4

| Attribute | Value |
|---|---|
| Extension | `.pdf` |
| MIME type | `application/pdf` |
| Library | `pdfjs-dist` v4 |
| Import | `const pdfjsLib = await import('pdfjs-dist')` |
| Worker setup | `pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'` |
| Worker file | Copied from `node_modules/pdfjs-dist/build/pdf.worker.min.mjs` to `public/pdf.worker.min.mjs` |
| Key method | `pdfjsLib.getDocument({ data: arrayBuffer }).promise` |
| Iteration | Loop pages 1..numPages; `page.getTextContent()` → join `item.str` strings |
| Return | String of all text content |
| Gotcha | Font-loading console warnings are harmless; text extraction still works |
| Scanned detection | `text.trim().length === 0` after parsing all pages → block with user error |

### DOCX — `mammoth`

| Attribute | Value |
|---|---|
| Extension | `.docx` |
| MIME type | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` |
| Library | `mammoth` |
| Import | `const mammoth = await import('mammoth')` |
| Key method | `mammoth.extractRawText({ arrayBuffer })` |
| Return | `{ value: string }` — use `result.value` |
| Blob URL | Not created for DOCX (preview uses extracted text, not the file) |
| Gotcha | None — works in browser without additional setup |

---

## Content Preview

### PDF Preview
- Blob URL created before parsing: `const blobUrl = URL.createObjectURL(file)`
- Passed to parent via `onFileLoaded(text, filename, blobUrl, 'application/pdf')`
- Rendered in `RightPanel` via `PDFViewer` component: `<iframe src={blobUrl} className="w-full h-full border-0" />`
- Preview takes full height of the right panel's top section (`flex-1 min-h-0`)
- Blob URL revoked on file clear: `URL.revokeObjectURL(previewUrl)`

### DOCX Preview
- `onFileLoaded(text, filename, '', fileType)` — empty string for previewUrl
- Right panel renders: `<pre className="text-[12px] font-mono ...">` with first 4,000 chars of `contractText`
- Truncation notice appended if `contractText.length > 4000`: `…(preview truncated)`
- Scrollable within the right panel's top section

### No file
- Right panel shows centered text: "Upload a document to see a preview"

---

## State Architecture

**Owner:** `app/chat/page.tsx` (the chat page)

| State var | Type | Passed to |
|---|---|---|
| `contractText` | `string` | POST /api/chat body |
| `contractFilename` | `string` | ChatComposer (chip label), RightPanel |
| `previewUrl` | `string` | RightPanel → PDFViewer |
| `fileType` | `string` | RightPanel (chooses renderer) |

**FileUpload component** owns zero state. It holds a ref to the hidden `<input>` element and calls `onFileLoaded` when parsing succeeds, or sets an internal `error` string if validation/parsing fails.

**Callback signature:**
```typescript
onFileLoaded(text: string, filename: string, previewUrl: string, fileType: string): void
```

- `text` — full extracted text; sent to backend with every message
- `filename` — displayed in composer chip and preview header
- `previewUrl` — blob URL (PDF) or empty string (DOCX)
- `fileType` — MIME type string used to select preview renderer

**Clear callback:**
```typescript
onClear(): void
```
Parent's `handleFileClear` revokes blob URL and resets all four state values to `''`.

---

## Validation

Performed in `FileUpload.tsx` before parsing begins:

| Check | Error message | Where shown |
|---|---|---|
| File MIME type not `application/pdf` or `.docx` MIME | "Only PDF and DOCX files are supported" | Below paperclip icon (12px, `text-an-error`) |
| File size > 10 MB | "File must be under 10 MB" | Same location |
| Zero text after PDF parse | "This PDF appears to be scanned (no text found). Please use a text-based PDF." | Same location |
| Parse throws an exception | "Failed to parse the file. Please try another file." | Same location |

---

## API Contract

- Route: `POST /api/chat`
- Field name: `contractText`
- Type: JSON string
- When no file: omit field entirely (not sent as empty string)
- Max: determined by Azure context window; no hard cap in API route

---

## Components

### `FileUpload.tsx`
| Prop | Type | Notes |
|---|---|---|
| `filename` | `string` | When non-empty, shows chip instead of button |
| `onFileLoaded` | `(text, filename, previewUrl, fileType) => void` | Called on successful parse |
| `onClear` | `() => void` | Called when user clicks X on chip |

Internal state: `error: string`, `parsing: boolean`. Nothing else.

### `PDFViewer.tsx`
| Prop | Type | Notes |
|---|---|---|
| `blobUrl` | `string` | Passed as `src` to `<iframe>` |
| `filename` | `string` | Title attribute |

Renders `<iframe src={blobUrl} className="w-full h-full border-0" title="PDF preview" />`. Simple wrapper — no page navigation or zoom controls in v1.0 (v1.1 enhancement).

---

## Edge Cases

| Scenario | Behaviour |
|---|---|
| User removes file after attaching | X button → `onClear()` → `URL.revokeObjectURL(previewUrl)` → all state reset to `''` |
| User attaches a second file | Old blob URL revoked first via `onFileClear()` call → new file parsed → state replaced |
| Parse fails mid-way | Error string shown in FileUpload; `onFileLoaded` not called; chat page state unchanged |
| PDF with zero extractable text (scanned) | Blocked at client with error message; no state update |
| File > 10 MB | Blocked at client before file is read |
| Unsupported file type (.txt, .xls, etc.) | Blocked at client before file is read |
| User sends a message without attaching a file | Allowed — `contractText` omitted from request; Azure responds based on question only |
| DOCX preview longer than 4,000 chars | Truncated with `…(preview truncated)` appended; full text still sent to backend |
| Session changed while file is loaded | File state is cleared when user navigates away (React component unmounts) |
| Blob URL never revoked | Prevented — revocation runs in `onFileClear` which is called on dismiss and on session navigation |
