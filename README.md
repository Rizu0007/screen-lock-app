# Screen Lock & Session Management

A Next.js 16 application where an authenticated user can lock the app from any page, unlock it with a pre-configured 6-digit PIN, and is signed out after three consecutive incorrect PINs.

The lock is enforced **on the server**. While a session is locked, no protected page, Server Action or API response is produced for it, so refreshing, using the back button, typing a URL or calling the API directly cannot get past it.

- **Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, PostgreSQL 17, Drizzle ORM, Argon2id, Zod, Vitest, Playwright

---

## Quick start

Requirements: Node 22+, Docker.

```bash
cp .env.example .env
# set AUTH_PEPPER to a random value:
#   openssl rand -base64 48
npm install
npm run setup        # start Postgres (port 5434), run migrations, seed demo users
npm run dev          # http://localhost:3000
```

### Demo accounts

| Email | Password | PIN |
|---|---|---|
| `demo@example.com` | `Demo-Password-1` | `246810` |
| `alex@example.com` | `Alex-Password-1` | `135790` |

Running `npm run db:seed` again resets these accounts: credentials, PIN counter, sessions and login throttle.

### Try it

1. Sign in and open **Projects → page 2**.
2. Press **Lock** in the header (or `Ctrl`+`Shift`+`L`).
3. On the lock screen, try refreshing, pressing Back, or opening `/dashboard` directly: you always land back on the lock screen.
4. Enter the PIN and you are returned to *Projects, page 2* without re-entering your password.
5. Lock again and enter a wrong PIN three times: every session of that user is ended and you are sent to the login page.
6. **Settings → Recent security activity** shows the audit trail.

---

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run setup` | `db:up` + `db:migrate` + `db:seed` |
| `npm run db:up` | Start Postgres with Docker Compose and wait until healthy |
| `npm run db:generate` | Generate a migration after changing `src/db/schema.ts` |
| `npm run db:migrate` | Apply migrations |
| `npm run db:seed` | Create or reset the demo accounts |
| `npm test` | Unit and integration tests (Vitest; needs the database) |
| `npm run test:e2e` | End-to-end tests (Playwright, against a production build) |
| `npm run typecheck` / `npm run lint` | Static checks |

---

## How it works

### Session state machine

```
anonymous ──login──▶ active ──lock──▶ locked ──correct PIN──▶ active
                       │                 │
                     logout     3rd wrong PIN / sign out
                       ▼                 ▼
                   anonymous (session row deleted)
```

Authentication and screen lock are kept **separate in the schema**:

| Table | Purpose |
|---|---|
| `users` | Identity and Argon2id password hash |
| `pin_credentials` | Argon2id PIN hash and the **per-user** `failed_attempts` counter |
| `sessions` | Authenticated sessions. The cookie holds a random 256-bit token and only its SHA-256 is stored. 24h absolute expiry. |
| `screen_locks` | One row means "this session is locked". It stores `locked_at` and `return_to`, and is deleted with the session (cascade). |
| `auth_events` | Audit trail: login, logout, lock, unlock, failed PIN, lockout |
| `login_attempts` | Fixed-window login throttle per (email, IP) |

### Where the lock is enforced

| Layer | Role |
|---|---|
| `src/server/dal.ts` | **The security boundary.** `getAuthState()` resolves the cookie to `anonymous`, `locked` or `active` (memoised per request). `requireActiveSession()` / `requireLockedSession()` are called by every page, Server Action and Route Handler. |
| `src/proxy.ts` | An optimistic, cookie-only pre-check with no database access. It redirects visitors without a cookie to `/login` and marks responses `no-store`. It is deliberately **not** relied on: Server Actions and RSC requests pass through to the DAL. |
| `src/app/(app)/layout.tsx` | App shell with the Lock button. Layouts are not re-rendered on client navigation, so each page calls the guard itself. |
| `src/components/session-guard.tsx` | Client companion that never grants access. It moves a tab away from protected content when the session changes elsewhere (BroadcastChannel hint, then a server re-check), on focus, and when the page is restored from the back/forward cache. |

### Lock → unlock flow

1. **Lock** (`lockAction`): the browser sends `pathname + search + hash`. The server validates it as a same-origin, in-app path (`src/lib/return-to.ts`) and inserts a `screen_locks` row. The client covers the screen at once, notifies other tabs, and does a **hard** navigation to `/lock`, which also discards Next's client router cache.
2. **Lock screen** (`/lock`): one masked numeric input (`type="password"`, `inputMode="numeric"`). Non-digits are stripped as you type, and Unlock stays disabled until 6 digits are entered. The server validates again with `^[0-9]{6}$`.
3. **Unlock** (`attemptUnlock` in `src/server/lock/service.ts`), in a single transaction:
   - `SELECT … FOR UPDATE` on the user's `pin_credentials` row, which serialises all attempts for that user
   - re-check that the session still exists and is still locked
   - verify the PIN with Argon2id
   - **correct:** counter reset to 0, lock removed, session token rotated, server redirect to `return_to`
   - **wrong (1st and 2nd):** counter +1, "N attempts remaining"
   - **wrong (3rd):** all of the user's sessions deleted, counter reset, cookie cleared, redirect to `/login?reason=pin_lockout`

---

## Requirement traceability

| Requirement | Implementation | Test |
|---|---|---|
| A1 Lock from any page | Header button + `Ctrl+Shift+L` in the shared app layout | `e2e`: lock from 4 pages, and the shortcut |
| A2 Dedicated lock screen | Separate `/lock` route, not an overlay; no app data is rendered | `e2e`: no app navigation or content on `/lock` |
| A3 Single numeric input | One `<input inputMode="numeric">` | `e2e`: exactly one `input` on the page |
| A4 Exactly 6 digits | Client stripping plus `maxLength`; server-side Zod `^[0-9]{6}$` | `unit`: 12 invalid inputs; `e2e`: typing letters |
| A5 Validate against configured PIN | Argon2id + pepper, compared on the server only | `integration` |
| A6 Return to previous page | `return_to` stored server-side, validated on write and on read, with query and hash | `e2e`: `/projects?page=3#top` |
| A7 No full re-authentication | Unlock removes the lock row and keeps the session | `e2e`, `integration` |
| B1 Track failed attempts (per user) | `pin_credentials.failed_attempts`; survives refresh; shared by all of the user's sessions | `e2e`: refresh, multi-device; `integration` |
| B2 3 wrong → invalidate, log out, redirect | All sessions deleted, cookie cleared, redirect to `/login?reason=pin_lockout` | `e2e`, `integration` |
| B3 Correct PIN resets the counter | Reset to 0 on success (and on password login) | `e2e`: correct PIN on the 3rd attempt, then counter back to full |
| B4 Standard login required afterwards | No session row means every route redirects to `/login` | `e2e`: replaying the old cookie is rejected |

---

## Security notes

### Threat model

| Attack | Mitigation | Proof |
|---|---|---|
| Refresh or type a URL while locked | Lock state lives in the database; every page runs the DAL guard | `e2e` bypass tests |
| Remove the lock overlay in DevTools | There is no overlay: locked sessions never receive protected HTML or data | `e2e` |
| Call the data API while locked | Route handlers return `423 Locked` (`{"code":"SCREEN_LOCKED"}`) | `e2e` |
| Bypass the proxy / middleware (e.g. CVE-2025-29927) | The proxy is not the security boundary; the DAL runs in every page, action and handler | Design |
| Back button or bfcache shows the previous page | `Cache-Control: no-store`, hard navigation to `/lock`, `pageshow` reload | `e2e` |
| Other tabs keep showing content | BroadcastChannel hint, then server re-check; re-check on focus | `e2e` multi-tab |
| More than 3 guesses via parallel requests | Row lock (`FOR UPDATE`) serialises attempts per user | `integration`: 8 parallel wrong PINs give exactly 2 invalid + 1 lockout |
| Correct PIN racing the lockout revives the session | Unlock re-checks the session under the row lock | `integration` |
| Extra guesses from a second device or session | The counter is per user; lockout ends every session | `e2e`, `integration` |
| Replay a stolen or old cookie | Tokens are stored hashed, rotated on unlock and deleted on lockout/logout | `e2e`, `integration` |
| Open redirect via the return path | Only same-origin in-app paths; control characters, `\`, `//`, encoded variants, `/lock`, `/login` and `/api` rejected | `unit`: 17 payloads |
| Offline PIN cracking after a database leak (10⁶ PINs) | Argon2id (19 MiB, t=2) keyed with a server-side pepper (`AUTH_PEPPER`), hash versioned for rotation | `integration` |
| User enumeration via login timing | Unknown emails still run a full Argon2 verification; one generic error | Design |
| Password brute force | 5 attempts per 15 minutes per (email, IP), counted atomically before verification | `integration` |
| Forged sign-out, lock or unlock from another site | Server Actions are POST-only with an Origin check, and the cookie is `SameSite=Lax` | Design |
| Clickjacking the lock screen | `X-Frame-Options: DENY`, `frame-ancestors 'none'` | Headers |
| Session fixation | Login always issues a new session and deletes the one presented | Design |
| Text injection via `?reason=` | Only allow-listed codes, mapped to fixed messages | `unit` |

The session cookie is `HttpOnly`, `SameSite=Lax`, and in production `Secure` with the `__Host-` prefix.

### Design decisions

- **The failed-attempt counter is per user, not per session.** The brief says "for the current user". Per-session counting would give an attacker 3 guesses per device.
- **Lockout ends all of the user's sessions,** so that no other session of the same user stays usable after a PIN brute-force attempt.
- **Malformed input does not consume an attempt.** Only a well-formed 6-digit PIN that fails verification counts as an "incorrect PIN".
- **Unlock, lockout and sign-out redirect from the server.** A Server Action that changes cookies makes Next re-render the current route, and that re-render would race any client-side navigation.
- **The token is rotated on unlock, not on lock.** Rotation on unlock invalidates any copy of the cookie taken earlier. Rotating on lock would trigger the same re-render race, and the lock row already blocks the session.
- **Status 423 Locked** for data requests from a locked session is distinct from `401` (no session), so API clients can tell the two apart.
- **Demo users instead of registration.** The brief says the PIN is "pre-configured". Registration would add attack surface without meeting any requirement.

### Known limitations

- `x-forwarded-for` is trusted for throttling and audit IPs. That is correct behind Vercel or a reverse proxy that overwrites it, but not on a bare server.
- Unsaved form input on the page is lost when locking, because of the hard navigation.
- If both the database **and** `AUTH_PEPPER` leak, a 6-digit PIN space is small enough to brute-force offline. This is inherent to 6-digit PINs.
- Changing the PIN, and idle auto-lock, are out of scope. Both are straightforward extensions (`pin_credentials`; a timer calling `lockAction`).

---

## Testing

```bash
npm test            # 52 unit + integration tests (real Postgres: row locks, cascades, races)
npm run test:e2e    # 17 Playwright tests against `next build && next start`
```

The integration tests create throwaway users and clean them up. The e2e tests reseed the demo accounts before running.

---

## Deploying to Vercel (with Neon)

1. Import the repository in Vercel.
2. **Storage → Create → Neon (Postgres)** and connect it to the project. This adds `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED`.
3. Add environment variables:

   | Name | Value |
   |---|---|
   | `AUTH_PEPPER` | output of `openssl rand -base64 48`. Use a new value per environment, and **never change it** once users exist. |
   | `SEED_DEMO_ACCOUNTS` | `true` for a demo/assessment deployment only |

4. Deploy. The `vercel-build` script runs the migrations, seeds the demo accounts (only when `SEED_DEMO_ACCOUNTS=true`) and builds.

With `SEED_DEMO_ACCOUNTS=true` the demo credentials are **shown on the login page**. That is intended for an assessment demo; do not enable it for real users.

---

## Project structure

```
src/
  app/
    (app)/            protected pages: dashboard, projects, projects/[id], settings
    actions/          Server Actions: login, logout, lock, unlock
    api/              session status probe, example data API (423 when locked)
    lock/             lock screen, PIN form, cross-tab guard
    login/            login page and form
  components/         lock button, sign-out, session guard, UI primitives
  db/                 Drizzle schema and client
  lib/                shared validation, return-path sanitiser, cross-tab channel
  server/             server-only code: DAL, sessions, hashing, lock service, audit, throttle
  proxy.ts            optimistic cookie pre-check + no-store
drizzle/              SQL migrations
scripts/seed.ts       demo accounts
tests/                Vitest unit + integration tests
e2e/                  Playwright tests
```
