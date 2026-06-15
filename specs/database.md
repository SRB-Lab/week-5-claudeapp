# Database Spec — Legal Document Analyzer

## Feature Name
Database Schema and Helper Functions

---

## Description

Supabase (PostgreSQL) is the primary data store. All reads and writes happen server-side via `@supabase/supabase-js` using the service role key — never from the client. The schema stores users, chat sessions, messages, and feedback. Supabase Auth is NOT used; authentication is entirely custom via a `users` table.

---

## Tables

### `users`
| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK, `gen_random_uuid()` | Auto-generated |
| email | TEXT | UNIQUE, NOT NULL | Used as login identifier |
| password_hash | TEXT | NOT NULL | bcryptjs, 10 rounds |
| created_at | TIMESTAMPTZ | DEFAULT `now()` | Set on insert |

### `sessions`
| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK, `gen_random_uuid()` | Auto-generated |
| user_id | UUID | FK → `users.id` ON DELETE CASCADE | Required |
| title | TEXT | DEFAULT `'New session'` | Updated to first 55 chars of first user message |
| status | TEXT | DEFAULT `'idle'` | Values: `idle`, `processing`, `completed`, `error` |
| pinned | BOOLEAN | DEFAULT `false` | Used for sidebar sort order |
| created_at | TIMESTAMPTZ | DEFAULT `now()` | Set on insert |
| updated_at | TIMESTAMPTZ | DEFAULT `now()` | Updated on every new message; also used for sort order |

### `messages`
| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK, `gen_random_uuid()` | Auto-generated |
| session_id | UUID | FK → `sessions.id` ON DELETE CASCADE | Required |
| role | TEXT | NOT NULL | Values: `user`, `assistant` |
| content | TEXT | NOT NULL | Full message text; no character limit |
| created_at | TIMESTAMPTZ | DEFAULT `now()` | Used for ordering (asc) |

### `feedback`
| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK, `gen_random_uuid()` | Auto-generated |
| user_id | UUID | FK → `users.id` ON DELETE CASCADE | Required |
| session_id | UUID | FK → `sessions.id` ON DELETE CASCADE | Required |
| rating | INTEGER | NOT NULL | 1–5; validated in API route |
| comment | TEXT | NULLABLE | Optional free-text; max 500 chars enforced client-side |
| created_at | TIMESTAMPTZ | DEFAULT `now()` | Set on insert |

---

## SQL — Create Tables

```sql
create table users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password_hash text not null,
  created_at timestamptz default now()
);

create table sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  title text default 'New session',
  status text default 'idle',
  pinned boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade,
  role text not null,
  content text not null,
  created_at timestamptz default now()
);

create table feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  session_id uuid references sessions(id) on delete cascade,
  rating integer not null,
  comment text,
  created_at timestamptz default now()
);

-- Performance indexes
create index on sessions(user_id, updated_at desc);
create index on messages(session_id, created_at asc);
create index on feedback(session_id);
```

Run in the Supabase SQL editor before starting the dev server.

---

## Supabase Client Files

### `lib/supabase.ts` — Client-side (public anon key)
Used only in client components (if any direct queries are needed on the client side).

```typescript
import { createClient } from '@supabase/supabase-js'
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
```

### `lib/supabase-server.ts` — Server-side (service role key)
Used in all API routes and `lib/db.ts`. Bypasses Row-Level Security.

```typescript
import { createClient } from '@supabase/supabase-js'
export const supabaseServer = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
```

---

## Helper Functions (`lib/db.ts`)

All functions use `supabaseServer`. None are called from client-side code.

| Function | Parameters | Returns | Table |
|---|---|---|---|
| `getUser(email)` | `email: string` | user row or `null` | `users` |
| `createUser(email, passwordHash)` | `email: string, passwordHash: string` | new user row | `users` |
| `createSession(userId, title?)` | `userId: string, title?: string` | new session row | `sessions` |
| `getSessions(userId)` | `userId: string` | `Session[]` ordered pinned desc, updated_at desc | `sessions` |
| `updateSession(id, patch)` | `id: string, patch: { title?, pinned?, status?, updated_at? }` | updated session row | `sessions` |
| `deleteSession(id)` | `id: string` | void | `sessions` (cascades) |
| `createMessage(sessionId, role, content)` | `sessionId: string, role: string, content: string` | new message row | `messages` |
| `getMessages(sessionId)` | `sessionId: string` | `Message[]` ordered by `created_at asc` | `messages` |
| `createFeedback(userId, sessionId, rating, comment?)` | all required except `comment` | new feedback row | `feedback` |

---

## Environment Variables

| Variable | Where to find | Required |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase dashboard → Project settings → API | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase dashboard → Project settings → API | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase dashboard → Project settings → API | Yes (server only) |

**Important:** `SUPABASE_SERVICE_ROLE_KEY` must never be exposed in client-side code. It is read exclusively in Next.js API routes and `lib/db.ts`.

---

## Row-Level Security Notes

RLS is disabled for MVP because all queries use the service role key (which bypasses RLS). Before moving to production, consider enabling RLS policies such as:

- Users can only SELECT their own `sessions` rows (`user_id = auth.uid()`)
- Users can only SELECT `messages` belonging to their sessions
- Cascade deletes are handled by FK constraints, not RLS

---

## Edge Cases

| Scenario | Behaviour |
|---|---|
| `getUser` returns null | Caller (login route) returns 401 "Invalid email or password" |
| `createUser` email already exists | Supabase unique constraint throws; caught and returned as 400 "Email already registered" |
| `updateSession` with empty patch | No-op; returns current row unchanged |
| `deleteSession` with no matching id | Supabase returns 0 rows affected; no error thrown |
| `getMessages` for non-existent sessionId | Returns empty array `[]` |
| `createFeedback` with rating outside 1–5 | Blocked at API route level before DB call |
