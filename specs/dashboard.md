# Dashboard Spec — Legal Document Analyzer

## Feature Name
Dashboard Layout and Home Screen

---

## Description

The dashboard is the post-login home screen at `/dashboard`. It uses a **3-panel layout** (sidebar / center / right panel) that is also shared by the chat page. The center of the dashboard shows KPI metric cards derived from the user's sessions data, plus a "Recent sessions" quick-access list. The sidebar provides navigation, session management, and user controls. The right panel shows document preview and execution steps (empty on the dashboard home view).

When a session is selected from the sidebar, the user navigates to `/chat?sessionId=<id>`. The dashboard page and the chat page are **separate routes** that each instantiate their own copies of Sidebar and RightPanel.

---

## Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  Sidebar (256px)    │  Center (flex-1)         │  Panel (304px)  │
│  bg-an-bg-subtle    │  bg-an-bg-base           │  bg-an-bg-subtle │
│                     │                           │                  │
│  Logo               │  Dashboard heading        │  Doc preview     │
│  New Chat button    │  KPI card grid (3 cols)   │  (empty)         │
│  Search input       │  Recent sessions list     │                  │
│  Filter tabs        │                           │  Exec steps      │
│  Session list       │                           │  (empty)         │
│  ─────────────────  │                           │                  │
│  User footer        │                           │  Azure connect   │
└──────────────────────────────────────────────────────────────────┘
```

---

## State Architecture

The dashboard page (`app/dashboard/page.tsx`) is a `'use client'` component that owns all state. State is not shared through context — each page manages its own.

| State | Type | Owner | Why here |
|---|---|---|---|
| `userId` | `string` | dashboard page | Read from localStorage; passed to sidebar and API calls |
| `userEmail` | `string` | dashboard page | Displayed in sidebar footer |
| `sessions` | `Session[]` | dashboard page | Sidebar session list + KPI derivations both need it |
| `loading` | `boolean` | dashboard page | Shows skeleton cards while fetching |

**Callbacks passed to Sidebar:**

| Callback | Signature | Triggers |
|---|---|---|
| `onNewChat` | `() => void` | POST /api/sessions → navigate to /chat |
| `onSelectSession` | `(id: string) => void` | router.push to /chat?sessionId= |
| `onRenameSession` | `(id: string, title: string) => void` | PATCH /api/sessions/[id] → update local state |
| `onPinSession` | `(id: string, pinned: boolean) => void` | PATCH /api/sessions/[id] → re-sort local state |
| `onDeleteSession` | `(id: string) => void` | DELETE /api/sessions/[id] → filter local state |

---

## Home / Default View

### KPI Cards

6 metric cards in a 3-column grid. All values derived from the `sessions` array already loaded — no additional API calls.

| KPI Label | Calculation | Icon |
|---|---|---|
| Total sessions | `sessions.length` | MessageSquare (coral) |
| Sessions today | `sessions.filter(s => new Date(s.created_at).toDateString() === today)` | Clock (coral) |
| Completed | `sessions.filter(s => s.status === 'completed').length` | CheckCircle (success green) |
| Pinned | `sessions.filter(s => s.pinned).length` | Pin (coral) |
| Processing | `sessions.filter(s => s.status === 'processing').length` | Loader2 (warning amber) |
| Failed | `sessions.filter(s => s.status === 'error').length` | AlertCircle (error red) |

**Loading state:** 6 skeleton divs (`h-24`, `animate-pulse`, `bg-an-bg-surface`) shown while sessions are fetching.

**Card anatomy:**
- Icon + label on one line (12px, `text-an-fg-muted`)
- Large numeric value below (28px, `font-medium`, `text-an-fg-base`)
- Optional sub-label (11px, `text-an-fg-muted`)
- Card: `bg-an-bg-surface`, `border border-an-border`, `rounded-lg`, `p-4`

### Recent Sessions

- Last 5 sessions from the already-loaded `sessions` array (`sessions.slice(0,5)`)
- Each row: status dot (color-coded) + title (truncated) + pin icon (if pinned) + date
- Clicking a row navigates to `/chat?sessionId=<id>`
- Empty state: card with "No sessions yet" text + "Start your first chat" primary button

---

## Sidebar

**Width:** 256px fixed. **Background:** `an-bg-subtle`. **Border:** `border-r border-an-border`.

### Logo area
- 20×20 coral circle + "Legal Contract Analyzer" text (13px, `font-medium`)
- Padding: `px-6 py-5`
- Separated from rest by `border-b`

### New Chat button
- Full-width, `h-9`, `bg-an-accent`, white text, `rounded-md`
- Icon: `Plus` (14px), label "New chat"
- Padding: `px-3 pt-3`
- Calls `onNewChat` → creates session → navigates to /chat

### Search input
- Positioned above filter tabs
- `Search` icon inside field (13px, left-padded)
- `h-8`, `bg-an-bg-surface`, `rounded-md`, 13px text
- Client-side filter: `session.title.toLowerCase().includes(query.toLowerCase())`
- Composes with active filter tab

### Filter tabs
6 pill-shaped filter chips displayed in a wrapping row:

| Tab | Filter logic |
|---|---|
| All | No filter |
| Pinned | `session.pinned === true` |
| Recent | `updated_at >= 7 days ago` |
| Processing | `session.status === 'processing'` |
| Completed | `session.status === 'completed'` |
| Error | `session.status === 'error'` |

- Active tab: `bg-an-accent-subtle`, `text-an-accent`
- Inactive tab: `bg-an-bg-surface`, `text-an-fg-muted`
- Filter AND search compose simultaneously

### Session list
- Scrollable (`flex-1 overflow-y-auto`)
- Padding: `px-3 py-2`, `space-y-0.5`
- Empty match state: "No sessions found" (12px, centered, `text-an-fg-muted`)

**Each session row:**
| Element | Spec |
|---|---|
| Height | `h-9` |
| Padding | `px-3` |
| Border-radius | `rounded-md` |
| Status icon | Left side, 12px Lucide icon |
| Pin indicator | `Pin` icon (10px, coral) shown only when `pinned === true` |
| Title | 13px, truncated to 1 line, `flex-1` |
| Timestamp | 12px, `text-an-fg-muted`, hidden on group hover to show `...` menu button |
| Default state | `text-an-fg-subtle`, transparent bg |
| Hover state | `bg-an-bg-surface`, `text-an-fg-base` |
| Active state | `bg-an-bg-elevated`, `text-an-fg-base` |

**Status icon mapping:**
| Status | Icon | Color |
|---|---|---|
| `idle` | `Minus` | `text-an-fg-muted` |
| `processing` | `Loader2` (spinning) | `text-an-warning` |
| `completed` | `CheckCircle` | `text-an-success` |
| `error` | `XCircle` | `text-an-error` |

### Session context menu

Triggered by `MoreHorizontal` button (shown on group hover). Opens a dropdown below the row.

| Action | Icon | API call | State update |
|---|---|---|---|
| Rename | `Pencil` | PATCH `/api/sessions/[id]` with `{ title }` | Replace title in sessions array |
| Pin / Unpin | `Pin` | PATCH `/api/sessions/[id]` with `{ pinned }` | Toggle + re-sort |
| Delete | `Trash2` (error color) | DELETE `/api/sessions/[id]` | Filter session out of array |

- Menu closes on outside click (via overlay div) or action taken
- Rename triggers inline `<input>` replacing the title in the row; Enter confirms, Escape cancels, Blur commits

### User footer
- `border-t border-an-border`, `px-3 py-3`
- First initial of email in 28×28 circle (`bg-an-bg-elevated`)
- Email address (12px, `text-an-fg-subtle`, truncated)
- Logout button: `LogOut` icon (14px), hover shows `bg-an-bg-surface`
- Logout action: `localStorage.clear()` → `router.push('/login')`

---

## Right Panel

**Width:** 304px fixed. **Background:** `an-bg-subtle`. **Border:** `border-l border-an-border`.

On the dashboard home view, the right panel is rendered with empty/default props:
- Document preview section: "Upload a document to see a preview" (empty state)
- Execution steps section: "No activity yet"
- Azure connection status: connection indicator + "Connect with Microsoft" link if not connected

---

## API Routes

### `GET /api/sessions?userId=`
Returns all sessions for the authenticated user, ordered by `pinned DESC, updated_at DESC`.

**Response:** `Session[]`
```json
[{ "id": "uuid", "user_id": "uuid", "title": "...", "status": "idle", "pinned": false, "created_at": "...", "updated_at": "..." }]
```

### `POST /api/sessions`
Creates a new session.

**Body:** `{ "userId": "uuid", "title": "New session" }`
**Response:** new session row

### `PATCH /api/sessions/[id]`
Updates one or more fields.

**Body (any subset):** `{ "title"?: string, "pinned"?: boolean, "status"?: string, "updated_at"?: string }`
**Response:** updated session row

### `DELETE /api/sessions/[id]`
Deletes session + cascades to messages and feedback.

**Response:** `{ "success": true }`

---

## Components

| Component | File | Responsibility | Key props |
|---|---|---|---|
| Sidebar | `components/Sidebar.tsx` | Full sidebar with all controls | sessions, activeSessionId, userId, userEmail, onNewChat, onSelectSession, onRenameSession, onPinSession, onDeleteSession |
| RightPanel | `components/RightPanel.tsx` | Document preview + execution steps + Azure status | steps, previewUrl, fileType, contractText, filename, azureConnected |
| Dashboard page | `app/dashboard/page.tsx` | Auth guard + data fetch + KPI cards + recent sessions | — (self-contained) |

---

## Edge Cases

| Scenario | Behaviour |
|---|---|
| No sessions on first login | KPI cards all show 0; "No sessions yet" empty state shown |
| Sessions API fails | Loading state clears; cards show 0 values (graceful degradation) |
| Delete the only session | Sessions array becomes empty; empty state shown |
| Rename with empty string | `onRenameSession` not called if `renameValue.trim()` is falsy; no API call |
| Filter + search returns nothing | "No sessions found" message in session list |
| Pin/Unpin | Sessions re-sorted immediately in local state (pinned to top) |
| Rapid click New Chat | Each click creates a new session; multiple sessions may appear |
| Auth guard fails | `router.replace('/login')` runs before any UI renders |
