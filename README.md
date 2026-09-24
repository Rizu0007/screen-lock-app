# Screen Lock & Session Management

A Next.js 16 app where a signed-in user can lock the screen from any page and unlock it with a 6-digit PIN. Three wrong PINs sign the user out.

The lock is enforced **on the server**, so refresh, the back button, a typed URL or a direct API call cannot bypass it.

**Stack:** Next.js 16 · React 19 · TypeScript · Tailwind 4 · PostgreSQL 17 · Drizzle ORM · Argon2id · Zod · Vitest · Playwright

## Contents

- [Quick start](#quick-start)
- [Demo accounts](#demo-accounts)
- [Try it](#try-it)
- [How it works](#how-it-works)
- [Requirements coverage](#requirements-coverage)
- [Security](#security)
- [Design decisions](#design-decisions)
- [Testing](#testing)
- [Deploy to Vercel](#deploy-to-vercel)
- [Project structure](#project-structure)
- [Limitations](#limitations)

---

## Quick start

Requires Node 22+ and Docker.

```bash
cp .env.example .env     # set AUTH_PEPPER: openssl rand -base64 48
npm install
npm run setup            # Postgres (port 5434) + migrations + demo users
npm run dev              # http://localhost:3000
```

| Script | Purpose |
|---|---|
| `npm run setup` | Start the database, migrate, seed |
| `npm run db:seed` | Reset demo accounts (credentials, PIN counter, sessions) |
| `npm test` | Unit and integration tests |
| `npm run test:e2e` | End-to-end tests (production build) |
| `npm run typecheck` / `npm run lint` | Static checks |

## Demo accounts

| Email | Password | PIN |
|---|---|---|
| `demo@example.com` | `Demo-Password-1` | `246810` |
| `alex@example.com` | `Alex-Password-1` | `135790` |

## Try it

1. Sign in and open **Projects → page 2**.
2. Click **Lock** (or press `Ctrl`+`Shift`+`L`).
3. Try refreshing, pressing Back, or opening `/dashboard`: you stay on the lock screen.
4. Enter the PIN and you return to *Projects, page 2* without a password.
5. Enter a wrong PIN 3 times and every session of that user ends.
6. See the audit trail in **Settings → Recent security activity**.

---

## How it works

```
anonymous ──login──▶ active ──lock──▶ locked ──correct PIN──▶ active
                       │                 │
                     logout     3rd wrong PIN / sign out
                       ▼                 ▼
                   anonymous (session deleted)
```

**Data model.** Lock state is kept separate from authentication:

| Table | Holds |
|---|---|
| `users` | Email, Argon2id password hash |
| `pin_credentials` | Argon2id PIN hash, **per-user** failed-attempt counter |
| `sessions` | SHA-256 of the cookie token, 24h expiry |
| `screen_locks` | A row means the session is locked (`return_to`, `locked_at`) |
| `auth_events` | Audit trail |
| `login_attempts` | Login throttle per email + IP |

**Enforcement layers:**

- **`src/server/dal.ts` is the security boundary.** Every page, Server Action and API route calls `requireActiveSession()` or `requireLockedSession()`.
- **`src/proxy.ts` is only an optimistic pre-check.** It sends visitors with no cookie to `/login` and sets `no-store`. It is not trusted for security.
- **`session-guard.tsx`** runs in the browser. It moves open tabs off protected pages when the session changes elsewhere (BroadcastChannel, focus re-check, back/forward cache reload).

**Unlock** runs in one database transaction:

1. `SELECT … FOR UPDATE` locks the user's PIN row, so parallel attempts run one at a time.
2. It re-checks that the session still exists and is still locked, then verifies the PIN.
3. The outcome is one of:
   - **Correct:** counter reset, lock removed, token rotated, redirect to the saved page.
   - **Wrong:** counter +1 and "N attempts remaining".
   - **3rd wrong:** all of the user's sessions deleted, redirect to `/login?reason=pin_lockout`.

---

## Requirements coverage

| Req | Implementation | Tested in |
|---|---|---|
| A1 Lock from any page | Header button + `Ctrl+Shift+L` | e2e |
| A2 Dedicated lock screen | Separate `/lock` route; no app data rendered | e2e |
| A3 Single numeric input | One `<input inputMode="numeric">` | e2e |
| A4 Exactly 6 digits | Client filtering + server `^[0-9]{6}$` | unit, e2e |
| A5 Validate PIN | Argon2id + pepper, server only | integration |
| A6 Return to previous page | `return_to` incl. query and hash, validated | e2e |
| A7 No full re-login | Unlock keeps the session | e2e, integration |
| B1 Track failures | Per-user counter; survives refresh | e2e, integration |
| B2 3 wrong → logout | All sessions deleted, redirect to login | e2e, integration |
| B3 Correct PIN resets | Counter reset to 0 | e2e, integration |
| B4 Login required after | Old cookie rejected | e2e |

---

## Security

| Attack | Mitigation |
|---|---|
| Refresh, direct URL, `/login` while locked | Lock stored in the database; every page checks it |
| Delete the lock overlay in DevTools | No overlay: locked sessions never receive protected content |
| Call the API while locked | `423 Locked` `{"code":"SCREEN_LOCKED"}` |
| Proxy/middleware bypass | Proxy is not the boundary; the DAL runs everywhere |
| Back button / cached pages | `no-store`, hard navigation to `/lock`, `pageshow` reload |
| Other open tabs | BroadcastChannel + server re-check |
| Parallel guesses beyond 3 | `FOR UPDATE` serialises attempts (tested with 8 parallel requests) |
| Extra guesses from another device | Counter is per user; lockout ends every session |
| Stolen or old cookie | Tokens hashed, rotated on unlock, deleted on lockout |
| Open redirect via return path | Only in-app paths; `//`, `\`, control chars, encoded tricks rejected |
| Database leak exposes PINs | Argon2id with a server-side pepper (`AUTH_PEPPER`) |
| Account enumeration by timing | Unknown emails still run a full hash check |
| Password brute force | 5 attempts / 15 min per email + IP |
| CSRF, clickjacking | POST-only Server Actions, `SameSite=Lax`, `frame-ancestors 'none'` |

Cookie: `HttpOnly`, `SameSite=Lax`, and in production `Secure` + `__Host-` prefix.

---

## Design decisions

- **Counter per user, not per session:** the brief says "current user". Counting per session would give 3 guesses per device.
- **Lockout ends all of the user's sessions,** so no other session of that user stays open after a brute-force attempt.
- **Malformed input is not counted.** Only a real 6-digit PIN that fails counts as an attempt.
- **Server-side redirects for unlock, lockout and sign-out.** Changing cookies in a Server Action re-renders the page, which would race client navigation.
- **Token rotated on unlock, not on lock.** That invalidates earlier cookie copies without the re-render race.
- **423 vs 401** lets API clients tell "locked" apart from "not signed in".
- **Seeded users, no registration:** the PIN is "pre-configured" per the brief.

---

## Testing

```bash
npm test            # 52 unit + integration tests on real Postgres (races, cascades, expiry)
npm run test:e2e    # 17 Playwright tests on a production build
```

---

## Deploy to Vercel

1. Import the repo in Vercel.
2. **Storage → Neon** → connect. This adds `DATABASE_URL` automatically.
3. Add environment variables:
   - `AUTH_PEPPER`: a new value from `openssl rand -base64 48`. Never change it once users exist.
   - `SEED_DEMO_ACCOUNTS`: `true`. This seeds the demo users and shows their logins on the login page. Use it for demos only.
4. Deploy. The `vercel-build` script migrates, seeds (if enabled) and builds.

---

## Project structure

```
src/
  app/(app)/     protected pages (dashboard, projects, settings)
  app/actions/   Server Actions: login, logout, lock, unlock
  app/api/       session status, example data API
  app/lock/      lock screen
  app/login/     login page
  components/    lock button, session guard, UI
  db/            schema + client
  lib/           validation, return-path sanitiser, cross-tab channel
  server/        DAL, sessions, hashing, lock service, audit, throttle
  proxy.ts       optimistic pre-check
drizzle/         migrations
scripts/seed.ts  demo accounts
tests/           unit + integration
e2e/             Playwright
```

---

## Limitations

- `x-forwarded-for` is trusted for throttling. That is fine behind Vercel or another proxy, but not on a bare server.
- Unsaved form input is lost when locking.
- If the database **and** the pepper both leak, 6-digit PINs can be brute-forced offline.
- Changing the PIN and idle auto-lock are out of scope, but easy to add.
