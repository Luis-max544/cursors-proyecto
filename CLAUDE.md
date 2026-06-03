# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

**NutriLearn** — educational video platform with freemium model (5 free videos/month → paid subscription) and creator revenue sharing (70% of subscription revenue distributed by monthly views).

**Stack:** Turborepo + pnpm 11 | Express + TypeScript (API) | React 19 + Vite (web) | PostgreSQL + Drizzle ORM | Redis | AWS S3 + HLS/FFmpeg | Stripe Subscriptions

**Status:** Documentation phase. `apps/` and `packages/` do not exist yet; scaffold them before writing code.

---

## Reference docs (read before writing code)

| Doc | Location |
|-----|----------|
| Database schema (Drizzle) | `docs/db_schema.md` |
| API spec (all endpoints) | `docs/api_spec.md` |
| Frontend architecture | `docs/frontend_architecture.md` |
| Monorepo setup | `docs/monorepo_setup.md` *(empty — TBD)* |

---

## Development commands

```bash
# Install deps (from repo root)
pnpm install

# Run all apps in dev mode
pnpm dev

# Build all packages + apps
pnpm build

# Run tests (all workspaces)
pnpm test

# Run tests for a single workspace
pnpm --filter @nutrilearn/api test
pnpm --filter @nutrilearn/web test

# Run a single test file
pnpm --filter @nutrilearn/api vitest run src/services/auth.test.ts

# DB migrations
pnpm --filter @nutrilearn/db drizzle-kit generate
pnpm --filter @nutrilearn/db drizzle-kit migrate

# Type-check everything
pnpm typecheck
```

---

## Monorepo structure

```
apps/api/          → Express REST API  (port 4000)
apps/web/          → React + Vite      (port 5173)
packages/db/       → Drizzle schema + migrations (@nutrilearn/db)
packages/types/    → Shared DTOs and enums (@nutrilearn/types)
packages/config/   → Zod-validated env vars (@nutrilearn/config)
```

All env vars are validated at startup in `packages/config/src/env.ts`. Always import from `@nutrilearn/config`, never use `process.env` directly.

---

## Architecture rules

### API (Express)
- Routes in `apps/api/src/routes/` — thin controllers only.
- Controllers: validate body with Zod → call service → return `{ data }` or `{ error: { code, message } }`.
- Business logic lives in `services/`, never in controllers.
- All controllers must `try/catch` and delegate to the global error handler.
- Pagination responses add `meta: { total, page, pages }`.

### Database
- Use Drizzle ORM client from `@nutrilearn/db`; no raw SQL unless justified by performance.
- Every migration must be reversible.
- Never add queries that cause N+1 — use joins or Drizzle's `inArray`.

### Frontend (React)
- Server state via TanStack Query — no `useEffect` for data fetching.
- Global auth + player state via Zustand (`stores/authStore.ts`, `stores/playerStore.ts`).
- All pages lazy-loaded with `React.lazy`.
- No prop drilling beyond 2 levels — use context or Zustand.
- API calls go through the centralized Axios instance in `lib/api.ts` (handles token refresh via interceptors).

### TypeScript
- `strict: true` everywhere.
- No explicit `any`; use `unknown` + type guards.
- All shared types exported from `@nutrilearn/types` — never duplicate.

### Naming
- Files: `kebab-case.ts` for utilities, `PascalCase.tsx` for components.
- DB tables: `snake_case`. Constants: `UPPER_SNAKE_CASE`.

---

## Critical business logic

### Paywall decision tree (`checkVideoAccess` middleware)

```
Has active Stripe subscription?
  YES → allow
  NO  →
    isPremium = true?  → 403 SUBSCRIPTION_REQUIRED
    isPremium = false  →
      freeViewsUsed < 5?  → allow + increment counter
      freeViewsUsed >= 5  → 403 FREE_LIMIT_REACHED
```

Free view counter lives in `free_views_tracker (user_id, month)` — the compound index on `(user_id, month)` is critical for performance.

### Upload flow

1. `POST /videos` → create DB record + return S3 presigned URL (expires ≤ 1 hour).
2. Client uploads directly to S3 (never through the API).
3. Files < 100 MB: single PUT. Files ≥ 100 MB: S3 multipart (5 MB chunks).
4. `POST /videos/:id/complete-upload` → enqueue FFmpeg job via BullMQ.
5. Worker converts to HLS, uploads `.m3u8` + segments, updates `videos.status = ready`.
6. FFmpeg jobs must run outside the request cycle in a separate worker process.

### Creator payout formula

```
pool = monthly_subscription_revenue * 0.70
creator_payout = (creator_monthly_views / platform_total_views) * pool
```

Recorded in `monthly_payouts` with a unique constraint on `(creator_id, month)`.

### Auth tokens
- Access token: 15 min. Refresh token: 30 days with rotation.
- Passwords: bcryptjs, 12 salt rounds.
- Rate limit auth routes: 5 req/min per IP (Redis).

### Stripe webhooks
- Always verify signature with `stripe.webhooks.constructEvent`.
- Idempotent: if event already processed, return 200 immediately.
- Events handled: `checkout.session.completed`, `invoice.payment_succeeded`, `invoice.payment_failed`, `customer.subscription.deleted`.

---

## Security constraints

- Rate limiting on all auth routes (5 req/min/IP via Redis).
- Validate upload MIME type with `file-type` library — do not trust file extension.
- S3 presigned upload URLs expire in ≤ 1 hour.
- HLS playback URLs: signed with 4-hour TTL (CloudFront or S3 presigned).
- CORS: only allow `CORS_ORIGIN` from env.
- Never log tokens, passwords, or secrets.
- Stack traces only in non-production (`NODE_ENV !== 'production'`).

---

## Testing

- Unit tests: Vitest.
- Integration tests required for: auth, videoAccess, payout services.
- S3 and Stripe: use their official testing SDKs/mocks.

---

## Error codes

| Code | HTTP | When |
|------|------|------|
| `UNAUTHORIZED` | 401 | Invalid/expired token |
| `FORBIDDEN` | 403 | Insufficient role |
| `SUBSCRIPTION_REQUIRED` | 403 | Premium video, no active sub |
| `FREE_LIMIT_REACHED` | 403 | 5 free views exhausted |
| `CREATOR_NOT_APPROVED` | 403 | Creator pending approval |
| `NOT_FOUND` | 404 | Resource missing |
| `VALIDATION_ERROR` | 422 | Invalid request body |
