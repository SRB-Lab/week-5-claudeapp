# Chat Spec — Legal Document Analyzer

## Feature Name
Chat Interface — Document Q&A Conversation

---

## Description

The chat interface lives at `/chat?sessionId=<id>`. Users attach a PDF or DOCX file, then ask questions in plain English. Each question is sent (along with the extracted document text) to `/api/chat`, which calls an Azure AI Foundry Agent and returns a grounded answer. Responses are NOT streamed in v1.0 — the full response is returned after polling completes. Conversation history is persisted in Supabase and reloaded when a session is reopened. The chat page uses the same 3-panel layout (Sidebar / ChatArea / RightPanel) as the dashboard.

---

## User Flow

1. User clicks "New Chat" in the sidebar → session created → navigate to `/chat?sessionId=<id>`
2. Chat page loads with empty message list
3. (Optional) User clicks paperclip icon → file picker opens → file parsed → preview appears in right panel
4. User types a question in the composer and presses Enter or the send button
5. Optimistic user message appears immediately in the message list
6. POST `/api/chat` with `{ sessionId, userMessage, contractText }`
7. Execution steps animate in the right panel: "Sending to Azure AI" → "Waiting for response" → "Completed"
8. Assistant response appears in the message list
9. FeedbackWidget shown below the last assistant message
10. User can ask follow-up questions; document context is included in every message
11. To resume a past chat: click the session in the sidebar → messages reloaded → user can continue

---

## Shared Context State

The chat page (`app/chat/page.tsx`) owns all shared state. The FileUpload component calls a callback and holds no state itself.

| State | Type | Owned by | Needed by |
|---|---|---|---|
| `contractText` | `string` | chat page | Sent with every POST /api/chat |
| `contractFilename` | `string` | chat page | ChatComposer chip, RightPanel header |
| `previewUrl` | `string` | chat page | RightPanel → PDFViewer iframe |
| `fileType` | `string` | chat page | RightPanel (chooses PDF vs DOCX preview) |
| `messages` | `Message[]` | chat page | MessageList render |
| `isLoading` | `boolean` | chat page | Disables composer, shows loading dots |
| `composerValue` | `string` | chat page | Controlled textarea |
| `steps` | `Step[]` | chat page | RightPanel execution steps |
| `azureConnected` | `boolean` | chat page | RightPanel connection status |

When `sessionId` changes: `messages` and `steps` are cleared immediately before fetching new messages.

---

## Message Rendering

### User messages
- Alignment: right (flex justify-end)
- Max-width: 75%
- Background: `rgba(217,119,87,0.15)` (`an-accent-subtle`)
- Border: `1px solid rgba(217,119,87,0.20)`
- Border-radius: `12px 12px 4px 12px` (flat bottom-right corner)
- Padding: `12px 16px`
- Font: 14px, `text-an-fg-base`

### Assistant messages
- Alignment: left (full max-width within 680px center column)
- No bubble background or border
- Prefix: 8×8 coral dot (`w-2 h-2 rounded-full bg-an-accent`) at top-left
- Text: `text-sm`, `text-an-fg-base`, `whitespace-pre-wrap`
- FeedbackWidget rendered below the **last** assistant message only

### Message timestamps
- Format: `HH:MM` if message is from today; `MMM D, HH:MM` if older
- Placement: below bubble (user) or below text (assistant), 11px, `text-an-fg-muted`
- Shown for all messages that have a `created_at` value

### Loading indicator
- Shown while `isLoading === true`
- Three bouncing dots styled like assistant prefix
- No assistant bubble until full response arrives

### Markdown
- Not rendered in v1.0 — responses are plain text (`whitespace-pre-wrap`)
- v1.1 enhancement: add react-markdown

---

## Non-streaming Responses (v1.0)

The full response is returned in a single JSON payload after Azure polling completes. No SSE or WebSocket. The `/api/chat` route blocks until the run is `completed` or `failed` (max 60s timeout).

Client-side: `fetch('/api/chat', ...)` awaits the full response. Loading state shown with bouncing dots until the response arrives.

---

## Conversation History

- **Persisted:** All user messages are saved to `messages` table before the API call. All assistant messages are saved immediately after the Azure response is received.
- **Auto-save:** Yes — every message is persisted before or during the API call; no manual action needed.
- **Reopen behavior:** On `sessionId` change, `messages` is set to `[]` immediately (prevents stale flash), then GET `/api/messages?sessionId=<id>` is called. All messages load at once (no pagination in v1.0).
- **Continue after reopening:** User types and sends without any extra step. Document text is NOT reloaded (user must re-attach the file).
- **History load error:** To be determined — currently shows empty list on failure.

---

## Message Bubble Styling (full detail)

**User bubble:**
```
align: flex justify-end
max-width: 75%
background: rgba(217,119,87,0.15)
border: 1px solid rgba(217,119,87,0.20)
border-radius: 12px 12px 4px 12px
padding: 12px 16px
font: 14px / 1.6 / text-an-fg-base
```

**Assistant bubble (no bubble):**
```
align: left
display: flex + gap-2 with coral dot prefix
max-width: 680px (constrained by parent)
background: none
border: none
font: 14px / 1.6 / text-an-fg-base
prefix: w-2 h-2 rounded-full bg-an-accent mt-2
```

---

## Components

| Component | Responsibility | Key props / state |
|---|---|---|
| `ChatArea` | Wrapper for MessageList + ChatComposer | messages, isLoading, userId, sessionId, composerValue, onComposerChange, onSend, filename, onFileLoaded, onFileClear |
| `MessageList` | Scrollable list + loading dots + empty state | messages, userId, sessionId, isLoading |
| `MessageBubble` | Renders one message (user or assistant) | message, userId, sessionId, isLast |
| `ChatComposer` | Textarea + paperclip + send button | value, onChange, onSend, isLoading, filename, onFileLoaded, onFileClear |
| `FileUpload` | Hidden file input + parsing + validation | filename, onFileLoaded, onClear |

---

## Optimistic Updates

- On send: user message appended to `messages` immediately with `created_at: new Date().toISOString()`
- No temporary ID needed — message is prepended before the API call
- If API fails: error assistant message appended (no rollback of user message — it was already saved to DB)
- If API returns 401 (not connected): error message shown inline, `azureConnected` set to false

---

## API Route — `POST /api/chat`

**Request body:**
```json
{
  "sessionId": "uuid",
  "userMessage": "What is the termination clause?",
  "contractText": "...full extracted text..." // optional; omit if no file attached
}
```

**Success response (200):**
```json
{
  "message": {
    "id": "uuid",
    "role": "assistant",
    "content": "The termination clause in Section 8.2 states...",
    "created_at": "2026-06-15T10:30:00Z"
  },
  "sessionTitle": "What is the termination clause…"
}
```

**Error responses:**
| Status | Body | Condition |
|---|---|---|
| 401 | `{ "error": "Not connected to Azure..." }` | `azure_token` cookie missing |
| 500 | `{ "message": { "role": "assistant", "content": "An error occurred..." }, "sessionTitle": "..." }` | Azure API error |

**Note:** Error responses still return an assistant message to display in the chat.

---

## API Route — `GET /api/messages?sessionId=`

**Params:** `sessionId` (UUID)
**Response:** `Message[]` ordered by `created_at ASC`
```json
[{ "id": "uuid", "session_id": "uuid", "role": "user", "content": "...", "created_at": "..." }]
```

---

## History Loading

- Messages cleared (`setMessages([])`) immediately when `sessionId` changes
- `GET /api/messages?sessionId=<id>` called in `useEffect` on `sessionId` change
- Loading state: empty message list (no skeleton — messages appear once loaded)
- Empty state message: "Upload a contract and ask your first question"

---

## Auto-Generated Titles

- Triggered: `/api/chat` checks session title before running Azure
- Condition: `session.title === 'New session'` — never overwrites a manually renamed title
- Value: `userMessage.slice(0, 55) + (userMessage.length > 55 ? '…' : '')`
- Persisted: `PATCH /api/sessions/[id]` with `{ title: newTitle }` in the `/api/chat` route
- UI update: `sessionTitle` returned in API response; chat page updates `sessions` array locally

---

## Edge Cases

| Scenario | Behaviour |
|---|---|
| Send without attached file | Allowed — `contractText` is omitted from request body; Azure responds based on question only |
| Send empty or whitespace message | Send button disabled when `value.trim().length === 0`; Enter key also blocked |
| Azure 401 (not connected) | Inline error message shown; right panel shows "Connect with Microsoft" |
| Azure timeout (>60s) | "The request timed out. Please try again." shown as assistant message |
| Azure run failed | "The AI was unable to process your request. Please try again." as assistant message |
| Switch sessions while loading | Messages cleared immediately on navigation; old response may still resolve and be saved to DB (harmless) |
| Delete active session | `onDeleteSession` calls `router.push('/dashboard')` and clears messages |
| Very long assistant response | Rendered fully with `whitespace-pre-wrap`; list scrolls; no truncation |
| Reopen chat without re-attaching file | File state is cleared; user can chat without document context |
| Network error on send | Catch block appends "Something went wrong. Please try again." as assistant message |
