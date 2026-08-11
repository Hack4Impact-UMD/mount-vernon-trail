# backend/ — Google Photos proxy

Express 5 + TypeScript (NodeNext), deployed on Render. See the root
[CLAUDE.md](../CLAUDE.md) for repo-wide context and
[README.md](README.md) for the full endpoint table, the one-time Google account
linking, and deployment settings — this file covers what to know before editing.

## Why this service exists

Every volunteer's before/after photos must land in **one shared album owned by the
MVT Google account**. No volunteer can own that album, and the app cannot hold the
MVT credentials. So the app authenticates to *this* service, and this service holds
the single Google refresh token.

Two independent auth layers:

| Layer | Who | Mechanism |
|---|---|---|
| caller → this API | every volunteer | `Authorization: Bearer <Firebase ID token>` on all `/api/*` |
| this API → Google Photos | the MVT account, once | admin OAuth flow, refresh token in Redis (+ env backup) |

```bash
npm run dev        # tsx watch
npm run build      # tsc -> dist/
npm start          # run the build
npm run typecheck  # tsc --noEmit
npm run lint       # eslint .
npm test           # jest + supertest — 91 tests, minutes on a cold cache
```

**The suite is slow but never hung.** Nothing in it sleeps — TTL and expiry
behavior is exercised through injected clocks (`createInMemoryStore(() => now)`),
not real timers. The cost is `ts-jest`: `jest.config.js` uses that preset, so every
suite is typechecked as it is transformed. A fresh clone or a cleared jest cache
pays that in full; later runs reuse it and finish far quicker. Do not kill it.

## Shape to preserve

`createApp(env, auth, tokenStore)` in [src/app.ts](src/app.ts) is exported so
supertest can drive the real app with fakes. [src/index.ts](src/index.ts) does
nothing but load env, construct dependencies, and listen.

**Keep new code injectable the same way.** Reaching for a module-level singleton or
reading `process.env` deep in a handler is what makes `app.test.ts` — the suite
covering auth, CORS, uploads and the admin OAuth bootstrap — impossible to write.

## Auth

[src/middleware/auth.ts](src/middleware/auth.ts) exports `requireFirebaseAuth(auth)`
and `requireAdmin`. All of `/api/*` is already mounted behind
`requireFirebaseAuth`, so a new `/api` route inherits it — do not re-add it.

`GET /auth/callback` is deliberately **not** behind Firebase auth: Google's
redirect cannot send an `Authorization` header. It is authenticated instead by a
single-use `state` nonce stored in Redis with a 600s TTL. Do not "fix" this by
adding the middleware.

`requireAdmin` checks the `admin` custom claim, set by
[scripts/set-admin-claim.ts](scripts/set-admin-claim.ts).

## Token store

[src/google-tokens.ts](src/google-tokens.ts). Access-token lookup order:

```
per-process memory cache  →  Redis (if ttl > 60s)  →  refresh
```

Refresh-token lookup order: Redis → the `GOOGLE_REFRESH_TOKEN` env var, which then
re-seeds Redis. That env fallback exists because a wiped free-tier Redis would
otherwise force an admin to redo the whole OAuth dance. Concurrent refreshes are
collapsed by an `inflight` promise.

Upstash is **optional locally** (falls back to an in-memory store with a warning)
and **required when `NODE_ENV=production`** — [src/env.ts](src/env.ts) refuses to
boot without it.

Env loading fails fast and names **every** missing variable at once. Keep that
behavior when adding a variable; see [.env.example](.env.example), which documents
all of them.

## Uploads

[src/routes/api.ts](src/routes/api.ts), `POST /api/upload`:

- multer `memoryStorage`, bounded concurrency of 4 via
  [src/concurrency.ts](src/concurrency.ts)
- `201` every photo uploaded · `207` partial, casualties named in `failed[]` ·
  `502` none uploaded (the `batchCreate` is skipped entirely)

Partial-failure tolerance is deliberate: one bad photo must not strand the rest of
a volunteer's event.

The **whole request is buffered in memory**, so `MAX_UPLOAD_FILES` ×
`MAX_UPLOAD_BYTES_PER_FILE` (default 10 × 10 MB) is a memory ceiling, not a policy
preference. Raising it on a 512 MB Render instance risks an OOM.

## Gotchas

- **`tsconfig.json` `include` is `src/**/*` only, so `npm run typecheck` does not
  cover `scripts/`** — even though those scripts import from `../src/`.
  `npm run lint` does cover them. Check a script edit with lint, or by running it
  in dry-run mode.
- `jest.config.js` sets `roots: ["<rootDir>/src"]`, so `scripts/` has no tests.
- `backfill`, `snapshot restore` and `triage --delete` are **dry-run by default**
  and require `--apply` to write. Read the dry-run output before applying;
  `backfill` prints a `REVIEW THESE` section for ambiguous documents.
- **`set-admin` is the exception — it has no dry run.** It takes only `<email>`,
  `--revoke` and `--list`, and a bare invocation grants the claim against the live
  project immediately. Passing `--apply` does not gate anything; it is ignored as a
  stray argument. Use `--list` first if you want to look before you write.
- Firestore is touched **only** from `scripts/`, never from `src/`. The service
  itself is stateless apart from the token store.
- Trello is not called from this service at all — it lives entirely in
  `frontend/services/trello-*.ts`.

## Parity constraint

[src/album-title-key.ts](src/album-title-key.ts) deliberately mirrors
`normalizeAlbumTitle` / `albumTitleKey` in
[../frontend/services/album-service.ts](../frontend/services/album-service.ts).
Both are pinned to
[../album-title-test-vectors.json](../album-title-test-vectors.json), asserted by
`src/__tests__/album-title-parity.test.ts` on this side and
`services/__tests__/album-service.test.ts` on the other.

**Change one and you must change the other.** If they drift, event setup and the
backfill migration compute different document ids for the same album title, and
the duplicate-title check silently stops working.
