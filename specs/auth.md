# Auth Spec — Legal Document Analyzer

## Feature Name
User Authentication — Signup and Login

---

## Description

Authentication uses a fully custom implementation. No Supabase Auth is used. Users sign up and log in with an email address and password. Passwords are hashed with bcryptjs (10 rounds) and stored in a custom `users` table in Supabase. On successful auth, the server returns `{ id, email }` and the client stores both values in `localStorage`. Protected pages check `localStorage` for `userId` on mount; if absent, the user is immediately redirected to `/login`.

Microsoft OAuth (`/api/auth/microsoft`) is a separate flow used exclusively for connecting to Azure AI — it is not the primary user authentication mechanism.

---

## User Flow — Signup

1. User visits `/signup`
2. Page renders in **light mode** (`data-theme="light"` on root div)
3. User fills in:
   - Email address (type="email", required)
   - Password (type="password", required, placeholder "At least 8 characters")
   - Confirm password (type="password", required)
4. **Client-side validation** before API call:
   - Password length ≥ 8 characters → show "Password must be at least 8 characters"
   - Password !== confirm → show "Passwords do not match"
5. Submit → POST `/api/auth/signup` with `{ email, password }`
6. **Server checks in order:**
   - Query `users` table for existing email
   - If found → return 400 `{ error: 'Email already registered' }`
   - `bcrypt.hash(password, 10)` → insert into `users`
   - Return 200 `{ id, email }`
7. Client stores `userId = data.id` and `userEmail = data.email` in `localStorage`
8. `router.push('/dashboard')`

---

## User Flow — Login

1. User visits `/login`
2. Page renders in **light mode** (`data-theme="light"` on root div)
3. User fills in:
   - Email address (type="email", required)
   - Password (type="password", required)
4. No client-side validation beyond HTML `required` attribute
5. Submit → POST `/api/auth/login` with `{ email, password }`
6. **Server checks in order:**
   - Query `users` table by email
   - If not found → return 401 `{ error: 'Invalid email or password' }` (generic — no field enumeration)
   - `bcrypt.compare(password, user.password_hash)` → if false → return 401 same generic error
   - Return 200 `{ id, email }`
7. Client stores `userId` and `userEmail` in `localStorage`
8. `router.push('/dashboard')`

---

## DB Schema

**Table: `users`**

| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK, `gen_random_uuid()` |
| email | TEXT | UNIQUE, NOT NULL |
| password_hash | TEXT | NOT NULL |
| created_at | TIMESTAMPTZ | DEFAULT `now()` |

---

## API Routes

### `POST /api/auth/signup`

**Request body:**
```json
{ "email": "user@example.com", "password": "mypassword" }
```

**Responses:**
| Status | Body | Condition |
|---|---|---|
| 200 | `{ "id": "uuid", "email": "user@example.com" }` | Success |
| 400 | `{ "error": "Email and password are required" }` | Missing fields |
| 400 | `{ "error": "Email already registered" }` | Duplicate email |
| 500 | `{ "error": "..." }` | Unexpected DB error |

### `POST /api/auth/login`

**Request body:**
```json
{ "email": "user@example.com", "password": "mypassword" }
```

**Responses:**
| Status | Body | Condition |
|---|---|---|
| 200 | `{ "id": "uuid", "email": "user@example.com" }` | Success |
| 401 | `{ "error": "Invalid email or password" }` | Email not found or password mismatch |
| 401 | `{ "error": "Invalid email or password" }` | Missing fields (same generic message) |

---

## Components

### `/signup` — `app/signup/page.tsx`
- `'use client'` component
- Standalone centered card layout (max-w-[400px], flex, min-h-screen)
- `data-theme="light"` on root div
- Fields: email, password, confirm password
- Error message rendered below form fields, above submit button
- Links to `/login` at the bottom

### `/login` — `app/login/page.tsx`
- `'use client'` component
- Same card layout as signup
- `data-theme="light"` on root div
- Fields: email, password
- Single generic error message slot
- Links to `/signup` at the bottom

---

## Auth Guard

Every protected page (`/dashboard`, `/chat`) runs this on mount:

```typescript
useEffect(() => {
  const id = localStorage.getItem('userId')
  if (!id) { router.replace('/login'); return }
  setUserId(id)
  setUserEmail(localStorage.getItem('userEmail') ?? '')
  // ... fetch data
}, [])
```

- Check: `localStorage.getItem('userId')` — truthy means authenticated
- Failure: `router.replace('/login')` — replaces history entry so back button does not return
- Runs in `useEffect` (client-side only; Next.js server render is not guarded)

---

## Important Implementation Notes

- **localStorage keys:** `userId` (UUID string) and `userEmail` (email string)
- **Service role key:** All DB writes use `supabaseServer` with the service role key — never the anon key for auth operations
- **Password column:** `password_hash` (not `passwordHash`) — matches Supabase snake_case convention
- **No Supabase Auth:** Do not use `supabase.auth.signIn`, `supabase.auth.signUp`, or any Supabase Auth methods
- **Logout:** `localStorage.clear()` then `router.push('/login')` — no server-side session to destroy
- **Microsoft OAuth** (`/api/auth/microsoft`) is for Azure AI connection only, not user login

---

## Design

Auth pages use **light mode** via `data-theme="light"` on the root container div. The body background remains dark by default; the `data-theme` attribute overrides CSS variables for the entire subtree.

| Element | Style |
|---|---|
| Page background | `bg-an-bg-base` (light: `#FAF9F7`) |
| Card | `bg-an-bg-subtle`, `border border-an-border`, `rounded-lg`, `p-6` |
| Card width | `max-w-[400px]`, full-width below |
| Logo | 32×32 coral circle (`bg-an-accent`) above heading |
| Heading | `font-display`, 28px, `font-medium`, `text-an-fg-base` |
| Sub-heading | 14px, `text-an-fg-subtle` |
| Input | `h-9`, `bg-an-bg-surface`, `border border-an-border`, `rounded-md`, `text-sm` |
| Input focus | `border-an-border-strong`, no outline |
| Submit button | Full width, `h-9`, `bg-an-accent`, `hover:bg-an-accent-hover`, white text, `rounded-md` |
| Error text | `text-[13px]`, `text-an-error` |
| Link | `text-an-accent`, `hover:text-an-accent-hover` |

---

## Edge Cases

| Scenario | Error shown | Where | Side |
|---|---|---|---|
| Password < 8 chars | "Password must be at least 8 characters" | Below form fields | Client |
| Passwords don't match | "Passwords do not match" | Below form fields | Client |
| Email already registered | "Email already registered" | Below form fields | Server (400) |
| Email not found on login | "Invalid email or password" | Below form fields | Server (401) |
| Wrong password on login | "Invalid email or password" | Below form fields | Server (401) |
| Empty email on login | "Invalid email or password" | Below form fields | Server (401) |
| Network error | "Something went wrong. Please try again." | Below form fields | Client catch |
| Submit button while loading | Disabled + "Signing in..." / "Creating account..." | Button text | Client |
| Navigate to /dashboard without userId | Immediate redirect to /login | — | Client (useEffect) |
