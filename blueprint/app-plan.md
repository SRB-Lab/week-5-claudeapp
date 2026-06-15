# App Plan — Legal Contract / Document Analyzer

## App Overview

An AI-powered document analysis tool. Users sign up, upload a PDF or DOCX contract (or any business document), ask questions in plain English, and receive answers grounded strictly in the document's text via an Azure AI Foundry Agent. All sessions, messages, and feedback ratings are persisted in Supabase. The interface follows the Anthropic/Claude design system.

**Primary persona:** Knowledge worker or analyst who reviews 5–20 documents per month and currently spends 1–3 hours per document.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS with custom CSS variables (Anthropic design system) |
| Database | Supabase (PostgreSQL) via `@supabase/supabase-js` |
| Auth | Custom `users` table + bcryptjs (no Supabase Auth) |
| AI | Azure AI Foundry Agents REST API (api-version `2025-05-01`) |
| Azure auth | `@azure/msal-node` — OAuth 2.0 Bearer token in HTTP-only cookie |
| PDF parsing | `pdfjs-dist` v4 (client-side, worker at `/public/pdf.worker.min.mjs`) |
| DOCX parsing | `mammoth` (client-side) |
| Icons | Lucide React (stroke 1.5px) |
| Hosting | Vercel |

---

## Pages

| Route | Purpose | Auth |
|---|---|---|
| `/` | Landing page — hero, features, auth CTAs | Public |
| `/signup` | Email + password signup, light mode | Public |
| `/login` | Email + password login, light mode | Public |
| `/dashboard` | Post-login home: KPI cards + recent sessions | Protected |
| `/chat?sessionId=` | 3-panel chat with sidebar, composer, right panel | Protected |

---

## User Flows

### Signup flow
1. User visits `/signup`
2. Fills in email, password, confirm password
3. Client validates: password ≥ 8 chars, passwords match
4. POST `/api/auth/signup` → check duplicate email → hash with bcrypt → insert into `users`
5. Server returns `{ id, email }`
6. Client stores `userId` + `userEmail` in localStorage
7. Redirect to `/dashboard`

### Login flow
1. User visits `/login`
2. Fills in email + password
3. POST `/api/auth/login` → query `users` by email → compare bcrypt hash
4. Generic error if email not found or password wrong ("Invalid email or password")
5. Server returns `{ id, email }`
6. Client stores `userId` + `userEmail` in localStorage
7. Redirect to `/dashboard`

### New chat flow
1. User clicks "New chat" in sidebar
2. POST `/api/sessions` with `{ userId, title: 'New session' }` → Supabase insert
3. Navigate to `/chat?sessionId=<newId>`
4. Chat page loads with empty message list

### File upload and send message flow
1. User clicks paperclip icon in ChatComposer
2. File picker opens (`.pdf,.docx` only, max 10 MB)
3. PDF → pdfjs-dist extracts text page-by-page; scanned (zero text) → blocked with error
4. DOCX → mammoth.extractRawText; blob URL not needed for DOCX
5. PDF: blob URL created for preview; passed up via `onFileLoaded(text, filename, blobUrl, fileType)`
6. Chat page owns `contractText`, `contractFilename`, `previewUrl`, `fileType` state
7. Right panel shows PDF iframe or DOCX text preview
8. User types a question and clicks send (or presses Enter)
9. Optimistic user message rendered immediately
10. POST `/api/chat` with `{ sessionId, userMessage, contractText }`
11. Right panel execution steps animate: Sending → Waiting → Completed
12. Assistant message appears; FeedbackWidget shown below it

### View previous chat flow
1. User clicks a session in the sidebar
2. Navigate to `/chat?sessionId=<id>`
3. Messages cleared immediately (prevent stale flash)
4. GET `/api/messages?sessionId=<id>` → render all messages
5. User can continue chatting (document text is NOT reloaded — user must re-attach)

### Submit feedback flow
1. FeedbackWidget appears below the last assistant message
2. User clicks 1–5 stars; optional comment textarea appears
3. Click "Submit feedback"
4. POST `/api/feedback` with `{ userId, sessionId, rating, comment }`
5. Widget shows "Thanks for your feedback" and hides

### Logout flow
1. User clicks logout button in sidebar footer
2. `localStorage.clear()` executes
3. Redirect to `/login`
4. Back button cannot return to dashboard (localStorage is empty → auth guard redirects)

---

## Database Tables

### `users`
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK, `gen_random_uuid()` |
| email | TEXT | UNIQUE, NOT NULL |
| password_hash | TEXT | bcryptjs 10 rounds |
| created_at | TIMESTAMPTZ | `now()` |

### `sessions`
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| user_id | UUID | FK → users.id ON DELETE CASCADE |
| title | TEXT | Default `'New session'`; auto-updated to first 55 chars of first user message |
| status | TEXT | `'idle'` / `'processing'` / `'completed'` / `'error'` |
| pinned | BOOLEAN | Default `false` |
| created_at | TIMESTAMPTZ | `now()` |
| updated_at | TIMESTAMPTZ | Updated on every new message |

### `messages`
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| session_id | UUID | FK → sessions.id ON DELETE CASCADE |
| role | TEXT | `'user'` or `'assistant'` |
| content | TEXT | Full message text |
| created_at | TIMESTAMPTZ | `now()` |

### `feedback`
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| user_id | UUID | FK → users.id ON DELETE CASCADE |
| session_id | UUID | FK → sessions.id ON DELETE CASCADE |
| rating | INTEGER | 1–5 |
| comment | TEXT | Nullable |
| created_at | TIMESTAMPTZ | `now()` |

**Indexes:**
```sql
create index on sessions(user_id, updated_at desc);
create index on messages(session_id, created_at asc);
create index on feedback(session_id);
```

---

## API Routes

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/signup` | Create user (check duplicate → hash → insert) |
| POST | `/api/auth/login` | Verify credentials, return user id |
| GET | `/api/auth/microsoft` | Generate Microsoft OAuth URL, redirect |
| GET | `/api/auth/microsoft/callback` | Exchange code for token, set `azure_token` HTTP-only cookie |
| GET | `/api/sessions?userId=` | List sessions for a user (pinned first, then by updated_at desc) |
| POST | `/api/sessions` | Create new session |
| PATCH | `/api/sessions/[id]` | Update title / pinned / status / updated_at |
| DELETE | `/api/sessions/[id]` | Delete session (cascades messages + feedback) |
| GET | `/api/messages?sessionId=` | Get all messages for a session (asc by created_at) |
| POST | `/api/messages` | Save a single message (used directly if needed) |
| POST | `/api/chat` | Main AI route: save user msg → call Azure AI → save response → return |
| POST | `/api/feedback` | Save feedback rating + comment |

---

## Components

### Shared layout
- `components/Sidebar.tsx` — session list, search, filter tabs, context menu, user footer
- `components/RightPanel.tsx` — document preview + execution steps + Azure connect status

### Chat
- `components/ChatArea.tsx` — wrapper for MessageList + ChatComposer
- `components/MessageList.tsx` — scrollable list, auto-scroll, loading dots
- `components/MessageBubble.tsx` — user/assistant bubble + FeedbackWidget for last assistant
- `components/ChatComposer.tsx` — auto-expanding textarea, paperclip, send button

### File handling
- `components/FileUpload.tsx` — hidden file input, parsing (pdfjs-dist / mammoth), validation
- `components/PDFViewer.tsx` — `<iframe>` with blob URL

### Feedback
- `components/FeedbackWidget.tsx` — 5-star rating + optional comment + submit

---

## Azure Integration

**Auth required:** Azure AD Bearer token (OAuth 2.0 via `@azure/msal-node`). API keys do NOT work.

**Flow in `/api/chat`:**
1. Read `azure_token` from HTTP-only cookie → 401 if missing
2. Save user message to `messages` table
3. Auto-title: if session title is still `'New session'`, update to `userMessage.slice(0,55) + '…'`
4. Update session status → `'processing'`
5. `POST {AZURE_AGENT_ENDPOINT_URL}/threads?api-version=2025-05-01` — create thread
6. `POST /threads/{threadId}/messages` — add message (contractText prepended as context)
7. `POST /threads/{threadId}/runs` — start run with `assistant_id` = `asst_xxx` + system prompt
8. Poll `GET /threads/{threadId}/runs/{runId}` every 2s until status = `completed` or `failed` (max 60s)
9. `GET /threads/{threadId}/messages` — retrieve first assistant message
10. Save assistant message to `messages` table
11. Update session status → `'completed'`; `updated_at = now()`
12. Return `{ message: { id, role, content, created_at }, sessionTitle }`

**System prompt injected on every run:**
> "You are an AI assistant. Answer questions based solely on the document text provided. Always cite the specific section or part you are referencing. If the answer cannot be found in the provided text, say: 'I cannot find this in the document.' Do not speculate beyond what the document contains."

---

## File Parsing

All parsing happens **client-side** in the browser before any data is sent to the server.

| File type | Library | Method | Worker/Setup |
|---|---|---|---|
| PDF | `pdfjs-dist` v4 | `getDocument()` → iterate pages → `getTextContent()` | `GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'`; copy file from `node_modules` to `public/` |
| DOCX | `mammoth` | `extractRawText({ arrayBuffer })` | No setup required; dynamic import avoids SSR issues |

**Scanned PDF detection:** if total extracted text length is 0 after parsing all pages → block with error "This PDF appears to be scanned (no text found)."

**State ownership:** `contractText`, `contractFilename`, `previewUrl`, `fileType` all owned by `app/chat/page.tsx` (the parent). `FileUpload` component calls `onFileLoaded(text, filename, url, type)` callback and holds no state itself.

**Preview:** PDF → iframe with `URL.createObjectURL(file)` blob URL in right panel. DOCX → `<pre>` with first 4,000 chars of extracted text. Blob URL revoked when file is cleared.

---

## Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=        # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=   # Supabase anon key (public)
SUPABASE_SERVICE_ROLE_KEY=       # Supabase service role key (server-only)

# Azure App Registration
AZURE_CLIENT_ID=                 # Application (client) ID from Azure Portal
AZURE_CLIENT_SECRET=             # Client secret value from Azure Portal
AZURE_TENANT_ID=                 # Directory (tenant) ID from Azure Portal

# Azure AI Agent
AZURE_AGENT_ENDPOINT_URL=        # https://<name>.services.ai.azure.com/api/projects/<project>
AZURE_AGENT_ID=                  # asst_xxx format — NOT the display name

# Auth callback
NEXTAUTH_URL=http://localhost:3000
```

---

## Build Phases

| Phase | What is built |
|---|---|
| 1 | Next.js 14 scaffold, Tailwind + design system tokens, globals.css, lib/supabase.ts, .env template |
| 2 | lib/db.ts — all Supabase helper functions (users, sessions, messages, feedback) |
| 3 | Auth API routes (signup, login) + auth pages (/login, /signup) with light mode |
| 4 | Dashboard layout (3-panel shell), Sidebar.tsx, RightPanel.tsx, /dashboard/page.tsx (KPI cards) |
| 5 | Chat interface — ChatArea, MessageList, MessageBubble, ChatComposer, /chat/page.tsx |
| 6 | File upload — FileUpload.tsx (pdfjs-dist + mammoth), PDFViewer.tsx, public/pdf.worker.min.mjs |
| 7 | Azure AI integration — /api/auth/microsoft, /api/auth/microsoft/callback, /api/chat |
| 8 | Feedback — FeedbackWidget.tsx, /api/feedback |
| 9 | Session polish — rename, pin/unpin, delete, search, filter tabs, session status icons |
