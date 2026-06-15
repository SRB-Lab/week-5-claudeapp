# Feedback Spec — Legal Document Analyzer

## Feature Name
Response Feedback — Star Rating and Comment

---

## Description

After every assistant message, a `FeedbackWidget` component is rendered inline below the message text. Users can rate the response on a 1–5 star scale and optionally leave a comment. On submit, the rating and comment are saved to the Supabase `feedback` table. After submission, the widget is replaced by a confirmation message and never shown again for that message. The widget appears only below the **last** assistant message in the list — older messages do not show it.

---

## User Flow

1. Assistant message appears in the chat list
2. `FeedbackWidget` renders inline below the message (visible immediately, no delay)
3. User hovers over stars — each star highlights up to the hovered star
4. User clicks a star → rating set; stars lock to selected state; optional comment textarea appears
5. User types an optional comment (max 500 chars, enforced via `maxLength` attribute)
6. User clicks "Submit feedback"
7. POST `/api/feedback` with `{ userId, sessionId, rating, comment }`
8. On success: widget replaced by "Thanks for your feedback" (12px, `text-an-fg-muted`)
9. On dismiss (user navigates away without rating): no submission; widget disappears naturally

---

## Placement

The `FeedbackWidget` is rendered as a child of `MessageBubble` when `isLast === true` and `message.role === 'assistant'`.

| Attribute | Value |
|---|---|
| Position type | Inline (below assistant message text) |
| Location | Directly under the assistant response text, within the message layout |
| Margin | `mt-3` above the widget |
| Width | Fills the assistant message column (full max-width) |
| No Z-index needed | Not floating; fully inline |

---

## DB Schema

**Table: `feedback`**

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK, `gen_random_uuid()` | Auto-generated |
| user_id | UUID | FK → `users.id` ON DELETE CASCADE, NOT NULL | Who submitted |
| session_id | UUID | FK → `sessions.id` ON DELETE CASCADE, NOT NULL | Which session |
| rating | INTEGER | NOT NULL | 1–5; validated in API route before insert |
| comment | TEXT | NULLABLE | Optional; max 500 chars enforced client-side only |
| created_at | TIMESTAMPTZ | DEFAULT `now()` | Set on insert |

No unique constraint per user per session — multiple ratings per session are allowed in v1.0 (one per assistant message). A unique constraint per `(user_id, session_id)` is a v1.1 enhancement.

**Index:**
```sql
create index on feedback(session_id);
```

---

## DB Tasks — What to Create

```sql
create table feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  session_id uuid references sessions(id) on delete cascade,
  rating integer not null,
  comment text,
  created_at timestamptz default now()
);

create index on feedback(session_id);
```

Run in the Supabase SQL editor. No migration files in v1.0.

---

## DB Helper Functions

### `createFeedback(userId, sessionId, rating, comment?)`

| Attribute | Value |
|---|---|
| File | `lib/db.ts` |
| Parameters | `userId: string, sessionId: string, rating: number, comment?: string` |
| Action | INSERT into `feedback` table |
| Returns | New feedback row |
| Duplicate check | None in v1.0 — multiple ratings per session allowed |

---

## API Routes

### `POST /api/feedback`

**Request body:**
```json
{
  "userId": "uuid",
  "sessionId": "uuid",
  "rating": 4,
  "comment": "Very helpful, found the exact clause." // optional
}
```

**Validation (server-side):**
- `userId`, `sessionId`, `rating` all required → 400 if any missing
- `rating` must be integer in range 1–5 → 400 `{ "error": "Rating must be an integer between 1 and 5" }`

**Success response (200):**
```json
{ "success": true, "feedback": { "id": "uuid", "rating": 4, "comment": "...", "created_at": "..." } }
```

**Error responses:**
| Status | Body |
|---|---|
| 400 | `{ "error": "userId, sessionId, and rating are required" }` |
| 400 | `{ "error": "Rating must be an integer between 1 and 5" }` |

---

## State Management

State is fully encapsulated within `FeedbackWidget`. The parent component (`MessageBubble`) only controls whether the widget is rendered at all (via `isLast` prop).

| State | Type | Initial | Notes |
|---|---|---|---|
| `rating` | `number` | `0` | 0 = no selection |
| `hover` | `number` | `0` | 0 = no hover |
| `comment` | `string` | `''` | Optional free text |
| `submitted` | `boolean` | `false` | When true, shows confirmation |
| `loading` | `boolean` | `false` | During API call |

When `submitted` becomes `true`, the entire form is replaced by the confirmation text. The widget is never shown again for that message (React state persists as long as the component is mounted; navigating away resets it — this is acceptable for v1.0).

---

## Component — `FeedbackWidget`

**Props:**
| Prop | Type | Notes |
|---|---|---|
| `userId` | `string` | From chat page state; read from localStorage |
| `sessionId` | `string` | From URL query param |

**Behaviour:**
- Stars: 5 `<button>` elements wrapping Lucide `Star` icons (14px, strokeWidth 1.5)
  - Unselected: `text-an-fg-muted`, unfilled
  - Hovered or selected: `text-an-accent fill-an-accent`
- No rating selected: comment textarea and submit button do NOT appear
- Rating selected: comment textarea (`rows=2`, max 500 chars) and submit button appear
- Submit button: `h-7 px-3 bg-an-accent text-white text-[12px] rounded-md`; disabled during API call
- Submit disabled when `loading === true`
- On success: `setSubmitted(true)` → renders `<p>Thanks for your feedback</p>`

**What the parent does NOT need to know:**
- Which star is selected
- Whether comment is typed
- Whether submission succeeded or failed
- The API call itself

---

## Design

| Element | Style |
|---|---|
| Widget container | `mt-3 space-y-2` |
| Star icons | 14px, `strokeWidth={1.5}`, 5 in a row with `gap-1` |
| Unselected star | `text-an-fg-muted` |
| Hovered/selected star | `text-an-accent fill-an-accent` |
| Rating count label | `text-[11px] text-an-fg-muted ml-1` (e.g. "4/5") |
| Comment textarea | `bg-an-bg-surface`, `border border-an-border`, `rounded-md`, `text-[13px]`, `rows=2`, `resize-none` |
| Comment focus | `border-an-border-strong`, no outline |
| Submit button | `h-7 px-3 bg-an-accent hover:bg-an-accent-hover text-white text-[12px] font-medium rounded-md` |
| Confirmation text | `text-[12px] text-an-fg-muted mt-2` |

---

## Edge Cases

| Scenario | Behaviour |
|---|---|
| User dismisses without submitting | No API call; widget disappears when user navigates away |
| User submits without a comment | `comment` omitted from request body (sent as `undefined`) |
| Submit fails (network error) | Currently: loading state clears; no error shown (graceful degradation in v1.0) |
| New assistant message arrives | FeedbackWidget moves to the new last message; previous widget disappears (no `isLast` prop) |
| Session changes while widget is visible | Component unmounts; submitted state resets |
| Rating = 0 (no star clicked) | Submit button not shown; cannot submit |
| Rapid double-click submit | Button disabled during loading; second click no-op |
| User clicks star after submitting | Not possible — widget replaced by confirmation text on submit |
