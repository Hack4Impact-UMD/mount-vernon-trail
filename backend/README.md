# mount-vernon-trail backend

Proxies Google Photos into the **MVT-owned** Google account so every volunteer's
before/after photos land in one shared album. The app never talks to Google
Photos directly — volunteers authenticate to *this* service with their Firebase
ID token, and the service uses a single server-held Google refresh token.

## Auth model

Two independent layers:

| Layer | Who | Mechanism |
|---|---|---|
| Caller → this API | every volunteer | `Authorization: Bearer <Firebase ID token>` on all `/api/*` routes |
| This API → Google Photos | the MVT account, once | admin OAuth flow, refresh token in Redis (+ optional env backup) |

Admin-only routes additionally require the `admin` custom claim. Grant it with
`npm run set-admin -- someone@example.com`.

## Endpoints

All `/api/*` routes require a valid Firebase ID token. They return `401` without
one, `401` if the MVT Google account has never signed in, and `502` when Google
Photos itself rejects the request.

| Method | Path | Auth | Body / query | Success |
|---|---|---|---|---|
| `GET` | `/` | none | — | `200 {service, ok}` |
| `GET` | `/auth/url` | ID token + `admin` claim | — | `200 {url}` — open it in a browser to link the MVT Google account |
| `GET` | `/auth/callback` | single-use `state` nonce | `?code&state` | `200` text |
| `GET` | `/api/auth/status` | ID token | — | `200 {authenticated}` |
| `POST` | `/api/upload` | ID token | multipart: `photos` (files), `albumId`, optional repeated `descriptions` | `201` all uploaded · `207` partial, see `failed[]` · `502` none uploaded |
| `POST` | `/api/albums` | ID token | `{title}` | `201` album |
| `GET` | `/api/albums` | ID token | `?pageToken` | `200 {albums, nextPageToken}` |
| `GET` | `/api/albums/:albumId` | ID token | — | `200` album |
| `GET` | `/api/albums/:albumId/photos` | ID token | `?pageToken` | `200 {mediaItems, nextPageToken}` |
| `GET` | `/api/photos/:photoId` | ID token | — | `200` media item · `404` if absent |

Uploads are bounded-concurrency and **partial-failure tolerant**: a single bad
photo no longer aborts the batch and strands the rest. Per-file failures come
back in `failed[]` so the client can retry just those.

Limits default to 10 files × 10 MB. Raise via `MAX_UPLOAD_FILES` /
`MAX_UPLOAD_BYTES_PER_FILE`, but note the whole request is buffered in memory —
a 512 MB instance cannot afford much more.

## Local development

```bash
cp .env.example .env      # then fill it in — every required var is documented there
npm install
npm run dev               # tsx watch, restarts on change
```

The server refuses to start if any required variable is missing, and names all
of them at once.

To run locally you need only three things: a Google OAuth client
(`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI`) and a
Firebase service account. **Upstash is optional locally** — leave it blank and
the token store falls back to memory, with a warning. It is mandatory when
`NODE_ENV=production`, where a lost refresh token means failing uploads.

`FIREBASE_SERVICE_ACCOUNT_JSON` takes either a path to the downloaded key file
(easiest locally) or the key inlined as one line (what Render needs).

### Linking the MVT Google account (once per environment)

1. Sign in to the app as a user holding the `admin` claim and copy their ID token.
2. `curl -H "Authorization: Bearer <ID token>" http://localhost:8080/auth/url`
3. Open the returned `url` in a browser and consent as the **MVT** Google account.
4. Google redirects to `/auth/callback`, which stores the refresh token in Redis.
5. Verify: `curl -H "Authorization: Bearer <ID token>" http://localhost:8080/api/auth/status`
   → `{"authenticated":true}`

Copy the refresh token into `GOOGLE_REFRESH_TOKEN` as a backup so a wiped
free-tier Redis does not force you to repeat this.

## Commands

```bash
npm run dev         # watch-mode server
npm run build       # tsc -> dist/
npm start           # run the build
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm test            # jest + supertest
```

## Layout

```
src/
  index.ts            entrypoint: load env, wire deps, listen
  app.ts              builds the Express app (exported so supertest can drive it)
  env.ts              typed env loading; fails fast listing every missing var
  errors.ts           NotAuthenticatedError / GooglePhotosError + shared responder
  firebase.ts         firebase-admin initialization
  google-tokens.ts    MVT access-token cache (memory -> Redis -> refresh) + OAuth
  google-photos.ts    Google Photos REST calls
  concurrency.ts      bounded-concurrency map that reports per-item outcomes
  middleware/auth.ts  Firebase ID token verification + admin claim check
  routes/             admin-auth.ts, api.ts
scripts/
  set-admin-claim.ts  grant/revoke the admin custom claim
```

## Deployment

Deployed on Render. Set every variable from `.env.example` in the Render
dashboard; `FIREBASE_SERVICE_ACCOUNT_JSON` must be the entire key file on one
line. Build `npm ci && npm run build`, start `npm start`.
