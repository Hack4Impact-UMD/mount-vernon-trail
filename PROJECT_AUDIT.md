# Project Audit — mount-vernon-trail

**Date:** 2026-08-06 · **Scope:** full repo (frontend app, backend proxy, config, git/GitHub state) · **Method:** 14-agent read-only audit — every screen/component/service/auth file read, `tsc --noEmit` + ESLint run against the repo's own toolchain, GitHub state verified via `gh` API. All findings marked **✓ verified** were independently re-confirmed by an adversarial second pass.

## 1. Summary

The app's core loops (auth → create event → document trail issues → publish) are mostly built, but the **photo pipeline — the project's central feature — is not connected end to end**: the backend upload proxy is fully implemented yet the frontend never calls it, no screen has upload UI, and albums are created in each volunteer's *personal* Google Photos library instead of the MVT-owned account. Several visible UI elements are dead (the "Take After Picture" home card, the entire trail-issue detail screen's inputs), the Past Events section is hardcoded Figma placeholder data, and the typecheck gate is broken. The repo has been dormant since **2026-05-09** with no open PRs, 7 open issues, and one nearly-finished fix stranded on an unpushed branch.

| Area | High | Medium | Low |
|---|---|---|---|
| Security | 1 | 3 | 3 |
| Confirmed bugs | 4 | 10 | 8 |
| Not implemented / incomplete | 5 | 6 | — |
| Failing checks | 1 (2 errors) | 3 | 8 |
| Repo & config hygiene | 3 | 3 | ~8 |

**Suggested priority order:**
1. Wire the frontend to the backend photo proxy (§4.1) — everything the app exists for depends on it
2. Add Firebase ID-token auth + CORS restriction to the backend (§2.1, §2.2) *before* wiring it up
3. Fix the null-token bug + tsconfig so `tsc --noEmit` passes again (§3.5, §5)
4. Make the trail-issue screen actually save (§4.3) and wire the "Take After Picture" card (§4.2)
5. Delete the stray root Expo scaffold and fix the iOS bundle ID before any EAS build (§6.1, §6.2)
6. Salvage `bugfix/move-issue-completed/jai` (open issue #67's nearly-finished fix) (§7)

---

## 2. Security vulnerabilities

### 2.1 [HIGH] Backend auth is a static shared API key, not Firebase ID-token verification — `backend/src/index.ts:19`
`requireApiKey` compares `x-api-key` against a single static `APP_SECRET_KEY`; `firebase-admin` isn't even a dependency, despite `backend/README.md` promising per-volunteer Firebase ID-token verification. An Expo app can only ship this key via an `EXPO_PUBLIC_*` var baked into the JS bundle, where anyone can extract it and then upload arbitrary content into the MVT album or enumerate its photos. **Fix:** add `firebase-admin` + middleware verifying `Authorization: Bearer <Firebase ID token>` (the `FIREBASE_SERVICE_ACCOUNT_JSON` entry in `.env.example` shows this was the intent).

### 2.2 [MEDIUM] CORS wide open; `ALLOWED_ORIGINS` ignored — `backend/src/index.ts:15`
`app.use(cors())` reflects any origin. Combined with the static key scheme, any website that learns the key can call the API from a browser. The `ALLOWED_ORIGINS` var in `.env.example` was planned but never implemented.

### 2.3 [MEDIUM] Trello API key + user token leaked into console logs — `frontend/services/trello-funcs.ts:359`
`getCardByID` (line 359) and `getEventCardByID` (line 378) log the raw Axios error object, whose `config.params` contains the Trello `key` and the user's `token` (injected by the interceptor at lines 65–69) — credentials end up in device logs / crash reporting. Every other method correctly logs only `getErrorMessage(error)`. `loadTrelloImage` (line 421) also logs raw errors (no credentials there).

### 2.4 [MEDIUM] Secret Trello token under `EXPO_PUBLIC_` prefix — `frontend/.env:2`, `frontend/.env.example:16`
`frontend/.env` holds a real 64-char Trello user token as `EXPO_PUBLIC_TRELLO_API_TOKEN`. Any referenced `EXPO_PUBLIC_*` var is inlined into the shipped JS bundle. It's currently dead (zero code references — the app switched to per-user OAuth tokens in SecureStore), and `.env` is gitignored so there's no repo leak, but one accidental reference ships a write-capable token in a public binary. **Fix:** delete the var from both files. Related: `GOOGLE_CLIENT_SECRET` / `GOOGLE_REFRESH_TOKEN` in `frontend/.env.example:12` are used only by the dev script `scripts/test-sheets.ts` — an OAuth client secret belongs in the backend env template, not the frontend's.

### 2.5 [LOW] MVT refresh token lives only in Upstash Redis — `backend/src/index.ts:151`
If the free-tier Redis instance is wiped, all uploads 401 until an admin redoes the curl-based OAuth dance. Support a `GOOGLE_REFRESH_TOKEN` env fallback or document recovery.

### 2.6 [LOW] Commit `"fixed leaked secret"` in backend history
Git history retains whatever leaked. Confirm the credential was actually **rotated**, not just removed.

### 2.7 [LOW] Google tokens persisted before Firebase sign-in completes — `frontend/auth/google-auth.ts:80-85`
`storeTokens` runs before `signInWithCredential`; if the Firebase sign-in fails, Google tokens remain in SecureStore while `auth.currentUser` is null — an inconsistent state the `SIGN_IN_FAILED` path never cleans up.

---

## 3. Confirmed bugs

### High severity (all ✓ verified)

**3.1 Camera DONE flow spawns a duplicate trail-document screen and loses notepad text — `frontend/app/camera-view.tsx:152`**
Stack is trail-document (A) → trail-issue (B) → camera (C). `handleDone` calls `router.replace("/trail-document-screen")`, which replaces C with a *new* trail-document instance (D) while A and B stay in the stack. Anything typed in A's notepad is lost (D starts empty and D's onStop passes the empty notepad to event-summary), back-gesture from D lands on stale B/A, all Trello issues re-fetch, and captured photos live only in D's in-memory state — never uploaded anywhere.

**3.2 Denying photo permission silently dead-ends the camera DONE button — `frontend/app/camera-view.tsx:144`**
`if (!permissionResponse.granted) return;` exits `handleDone` before any navigation. Tap DONE → nothing happens, no alert, photo unrecoverable except via RETAKE. (`before-after-graphic.tsx:76-82` handles the same case correctly with an Alert.)

**3.3 Null access token flows into `Authorization: Bearer null` — `frontend/services/googlePhotosAlbumsService.ts:70,95`**
`getValidAccessToken()` returns `string | null` but is assigned to `let accessToken: string` — these are the repo's only two real `tsc` errors (TS2322). At runtime a null token produces an opaque Google 401 instead of a sign-in prompt; line 95 is the 401-*retry* path, where an expired/refreshed-failed (null) token is most likely. **Fix:** null-check and throw `AuthError("TOKEN_RETRIEVAL_FAILED")`.

**3.4 Dead error handling and a no-op 401 retry in `createGoogleAlbum` — `frontend/services/googlePhotosAlbumsService.ts:92`**
The catch expects `getValidAccessToken` to throw `AuthError`, but it never throws (it catches internally and returns null) — the `TOKEN_RETRIEVAL_FAILED` branch is unreachable. The 401 retry re-calls `getValidAccessToken()`, which returns the *same cached token* (no force-refresh parameter exists), replaying the identical failing request. Error detection is fragile `errorMessage.includes("401")` string matching.

**3.5 `createEvent` overwrites the Firestore albums doc, breaking duplicate-album detection — `frontend/services/event-service.ts:152`**
`storeAlbum` writes `albums/{albumId}` with a lowercased title (which `albumNameExists` queries against). `createEvent`'s `batch.set` on the same doc has no `{merge: true}`, replacing it with the original-cased title and dropping `createdBy`. Any album title containing an uppercase letter is never detected as a duplicate again.

### Medium severity

- **3.6 Any user's live event affects everyone** — `frontend/services/event-service.ts:197-214`: `getActiveEvent` queries all events with `startDate != null` and no user filter (despite the "for this user" comment at `(tabs)/index.tsx:22`). Any signed-in user gets redirected into — and can *end*, via `active-event.tsx` — an event someone else started.
- **3.7 Albums screen renders bare `0` in a View (RN crash)** — `frontend/app/albums.tsx:149`: `{photoCount && <View>…}` with `photoCount: number | null`; an empty album (count 0 — every album starts empty) renders the raw `0`, throwing "Text strings must be rendered within a `<Text>` component". Use `photoCount !== null && photoCount > 0 &&`.
- **3.8 Publish marks Firestore published before Trello moves** — `frontend/app/edit-draft.tsx:121-123`: if `moveCardToCompleted`/`moveCardAttachmentsToCompleted` throws after `publishEvent`, the event is already `isDraft=false` and gone from Drafts — no way to retry the Trello move from the UI. Make Firestore the last step or add rollback.
- **3.9 Event creation has no rollback** — `frontend/app/setup-event.tsx:99-133`: album → Trello card → attach link → Firestore event runs sequentially with no compensation; failure partway orphans the earlier artifacts, and retrying duplicates them.
- **3.10 Web/native token-storage asymmetry** — `frontend/auth/token-storage.ts:22`: reads branch to `localStorage` on web but writes/deletes always use SecureStore, whose web module is literally `export default {}` — so web sign-in is broken (or the web branch is dead code). `trello-token-storage.ts` has no web branch at all.
- **3.11 Missing token expiry treated as "expired"; the two getters disagree** — `frontend/auth/google-auth.ts:147` vs `token-storage.ts:60-63`: `getValidAccessToken` requires a truthy `tokenExpiry`, but `storeTokens` skips writing one when `expiresIn` is undefined (optional on expo-auth-session's response) — a freshly stored token with no refresh token looks signed-out immediately. The sibling `getAccessToken` implements the *opposite* rule (missing expiry = valid).
- **3.12 Web token refresh always fails** — `frontend/auth/google-auth.ts:110-131`: the `refresh_token` grant is sent without `client_secret`, which Google web-application clients require — `invalid_client` every time on web.
- **3.13 Undeclared Firestore composite index** — `frontend/services/event-service.ts:298-302`: `where("isDraft","==",true)` + `orderBy("savedAsDraftAt","desc")` needs a composite index, and no `firebase.json` / `firestore.indexes.json` / `firestore.rules` exists in the repo — a fresh environment throws `failed-precondition` when Drafts loads. Docs missing `savedAsDraftAt` are also silently excluded.
- **3.14 Backend buffers up to ~1 GB per upload request in RAM** — `backend/src/index.ts:28`: multer `memoryStorage` × 20 MB/file × 50 files, plus `Uint8Array` copies. A Render starter instance (512 MB) OOMs well before the limit; uploads are also serial.
- **3.15 Registered route `mock-statistics` has no route file** — `frontend/app/_layout.tsx:93,175`: Expo Router warns at runtime; leftovers from a deleted screen.

### Low severity

- **3.16** Camera preview thumbnail always labeled "Before", even in after mode — `frontend/app/camera-view.tsx:257`
- **3.17** Trail-issue card: only the 32px arrow is tappable, not the card body — `frontend/components/ui/trail-doc-issues-card.tsx:51-60` (the sole way to open an issue)
- **3.18** setup-event Cancel button styled with web-only `outlineWidth/outlineColor` — invisible border on iOS/Android — `frontend/app/setup-event.tsx:449-456`; `handleCancel` is also a silent no-op when there's no back history
- **3.19** `handlePressEvent`/`handleStartEvent` swallow Firestore errors → event modal opens silently missing leader/zone data — `frontend/app/home-screen.tsx:95,118`; `eventsError` never cleared on refetch
- **3.20** active-event error state's "Go Back" can be a no-op after `router.replace` navigation — `frontend/app/active-event.tsx:69`
- **3.21** Album duplicate check is check-then-act with no transaction — concurrent creators both pass; if `storeAlbum` fails after `createAlbum`, the Google album exists with no Firestore record — `frontend/services/googlePhotosAlbumsService.ts:82`
- **3.22** `getActiveEvent` scans every ever-started event client-side (`where("startDate","!=",null)`, endDate filtered in JS) — cost grows with history; use `where("endDate","==",null)` — `frontend/services/event-service.ts:199-210`
- **3.23** Backend `GET /auth/url` requires an `x-api-key` header but responds with a 302 — unusable from a browser; CSRF nonce stored under a single global Redis key so concurrent auth attempts clobber each other — `backend/src/index.ts:115`

---

## 4. Not implemented / incomplete

### 4.1 [HIGH] The photo upload pipeline is not connected end to end
The single biggest gap. The backend (`backend/src/index.ts`) is a **complete** upload proxy — `POST /api/upload`, `POST/GET /api/albums`, per-album photo listing, admin OAuth flow, Redis token cache — but:
- The frontend calls **zero** backend endpoints: no base-URL env var, no `x-api-key` usage, no fetch to any Render URL anywhere in `frontend/`.
- `frontend/api/googlePhotosClient.ts` instead hits `photoslibrary.googleapis.com` directly with each **volunteer's personal OAuth token** — so albums created by `setup-event.tsx` and listed by `albums.tsx` live in each volunteer's *own* Google Photos library, not the MVT account. Volunteers can't see each other's albums, defeating the shared-album design.
- `uploadPhotoBytes`/`createMediaItems` are called only by the dev script `frontend/scripts/test-api.ts` (which uploads dog.ceo images). **No screen has photo-upload UI at all** — `event-summary.tsx`'s "upload" is Trello-only.
- The backend also drops per-photo `description` metadata the frontend client model supports (`backend/src/index.ts:253`).

**To build:** a frontend backend-client (base URL + auth header), rewire `googlePhotosClient.ts` / `googlePhotosAlbumsService.ts` / `albums.tsx` / `setup-event.tsx` to the proxy endpoints, add an upload UI, then drop the `photoslibrary.*` scopes from client OAuth. Do §2.1/§2.2 first.

### 4.2 [HIGH, ✓ verified] "Take After Picture" home card does nothing — `frontend/app/home-screen.tsx:148`
Rendered with no `onPress` (the component's `onPress` is optional and passed straight to TouchableOpacity). The two sibling cards are wired; this one — the most prominent card on the home screen — was simply never hooked up.

### 4.3 [HIGH, ✓ verified] Trail-issue screen never saves anything — `frontend/app/trail-issue-screen.tsx:30`
Notes and metrics are plain `useState` bound to TextInputs with **no save/submit path in the file**; leaving the screen discards everything. `status` is `const status = "In Progress"; // hardcoded for now`. The `isNew` param that `trail-document-screen`'s "Add Issue" flow passes is never read, so newly added issues are never created in Trello or Firebase — they vanish on back-navigation. The metrics input placeholder is literally "Metric #1".

### 4.4 [HIGH] Past Events section is hardcoded Figma placeholder data — `frontend/app/home-screen.tsx:23-52`
`PLACEHOLDER_PAST_EVENTS` (commented as Figma placeholders) renders to every user; tapping a past event only `console.log`s; both `onShowMore` handlers are `() => {}`; and the status pill is a hardcoded "Not started" constant (`upcoming-events-card.tsx:34-38`), so past events display as "Not started".

### 4.5 [HIGH] Google Sheets integration unreachable — `frontend/services/googleSheetsServices.ts` (0 bytes)
The service file is empty; `api/googleSheetsClient.ts` is called only by the Node-only script `scripts/test-sheets.ts`; no spreadsheet ID exists in app-reachable config. Meanwhile the app requests the `spreadsheets` OAuth scope from every user (`auth/google-auth.ts:25`) for a feature that doesn't exist — either build it or drop the scope.

### Medium
- **4.6 Active-event resume is dead code** — `frontend/app/_layout.tsx:34,49-69`: `isEligibleActiveEvent` is computed via a Firestore query on every auth change and never read; the routing effect ignores it. A user who kills the app mid-event lands on home-screen with no indication an event is running. (The only auto-redirect lives in the unreachable dev screen `(tabs)/index.tsx`.)
- **4.7 Trello is pinned to "MVT Mock Board"** — `frontend/services/trello-service.ts:8-12`: board + four list names hardcoded; switching to the real MVT board requires a code change. Every operation also re-fetches all boards and lists (2 extra round-trips, nothing cached).
- **4.8 Google Photos client TODOs / no 401 refresh** — `frontend/api/googlePhotosClient.ts:109,144,185`: three "TODO add better error handling" paths throw generic errors and never attempt token refresh on 401.
- **4.9 `// TODO check if these should be required`** above zoneLeaders/toolHaulers/gloverLover validation — `frontend/app/setup-event.tsx:82`.
- **4.10 event-summary's `savedTrello` state can never become true** — `frontend/app/event-summary.tsx:230`: setter never called; the check-icon branch and gated "Back to home screen" card are unreachable leftovers from a repurposed action card.
- **4.11 Backend `.env.example` doesn't match the code** — lists 3 vars the code never reads (`GOOGLE_REFRESH_TOKEN`, `FIREBASE_SERVICE_ACCOUNT_JSON`, `ALLOWED_ORIGINS`) and omits 5 it requires (`APP_SECRET_KEY`, `ADMIN_SECRET_KEY`, `UPSTASH_REDIS_REST_URL/TOKEN`, `GOOGLE_REDIRECT_URI`) — provisioning from it yields a server where every request 401s and Redis throws at first use.

### Open GitHub issues (7)

| # | Title | Priority | Notes |
|---|---|---|---|
| 88 | Error handling for Google Photos uploads | P2 | pairs with §4.1 |
| 73 | Draft of an event should only appear for specific event leader | P2 | pairs with §3.6 (no user scoping) |
| 67 | Don't move issues to completed that don't have an after photo | P2 | *info needed*; nearly-finished fix stranded on `bugfix/move-issue-completed/jai` (§7) |
| 75 | Fix linking errors | P3 | |
| 69 | Back Button | P3 | pairs with §3.1 |
| 68 | Add app icon | P3 | |
| 51 | Trail issue pages load slowly | P3 | pairs with §4.7 (uncached board/list fetches) |

---

## 5. Failing checks

**`tsc --noEmit`: 62 errors.** 60 are identical TS2686 ("'React' refers to a UMD global") caused by one line — `frontend/tsconfig.json:5` sets `"jsx": "react"`, overriding Expo's base config. **One-line fix: change to `"jsx": "react-jsx"`.** The other 2 are the real null-token bugs (§3.3). Until fixed, the typecheck gate is useless.

**ESLint: 1 error, 12 warnings.** The error: unescaped apostrophe (`react/no-unescaped-entities`) at `frontend/components/ui/trail-event-card.tsx:58` — fails any lint CI gate. Warnings: missing `router` dep (`app/auth.tsx:24`); unused vars confirming dead code — `isEligibleActiveEvent` (`_layout.tsx:34`), `afterImageUri` (`camera-view.tsx:38`), `setSavedTrello` (`event-summary.tsx:230`), `activeEventId` (`trail-document-screen.tsx:49`), 4 unused imports in `trello-login.tsx`; `require()` import (`config/firebase.ts:6`); 2 axios member-access style warnings (`trello-funcs.ts:53,83`).

**Backend: cannot be typechecked** — no `node_modules`, no lockfile. One strict-mode concern visible from source: `process.env.UPSTASH_REDIS_REST_URL/TOKEN` (`string | undefined`) passed directly to `new Redis({...})` (`backend/src/index.ts:34-37`) will likely fail `tsc` strict once deps are installed.

---

## 6. Repo & config hygiene

### 6.1 [HIGH] Accidental second Expo project at the repo root — delete it
Root `app.json`, `package.json`, `tsconfig.json` (untracked) plus ignored `node_modules/` (412 pkgs), `ios/`, `.expo/`, `package-lock.json` are byproducts of running `expo prebuild`/`pod install` from the root instead of `frontend/` (all dated May 4). The root package.json pins **expo ^55 / react 19.2 / RN 0.83** vs frontend's **expo ~54 / react 19.1 / RN 0.81** — Metro's hierarchical resolution can walk up and grab the wrong React, producing duplicate-React "invalid hook call" failures. The three untracked JSONs will ride along with the next `git add .`. Nothing is tracked yet — delete all of it.

### 6.2 [HIGH] iOS bundle ID still `com.anonymous.mountvernontrail` — `frontend/app.json:17`
The uncommitted diff renames Android to `com.hack4impact.mountvernontrail` but leaves iOS on the placeholder. EAS would provision iOS credentials under `com.anonymous.*` (unchangeable after first App Store submission), and the Google OAuth reversed-client-id schemes (lines 10–11) are tied to specific bundle ids. Update iOS in the same commit and re-prebuild `frontend/ios/`. (The root `ios/` even has a *fourth* identifier, `org.name.mountvernontrail` — see §6.1.)

### 6.3 [HIGH] EAS is not actually set up — `frontend/app.json` + `frontend/eas.json`
No `extra.eas.projectId`, no `owner` — the app was never linked via `eas init`, so non-interactive/CI builds fail immediately. All runtime config is `EXPO_PUBLIC_*`-driven and local `.env` is **not** uploaded to EAS: unless every var is defined in the expo.dev "preview"/"production" environments, cloud builds bundle undefined Firebase config and crash at startup. `submit.production` is `{}`, so `eas submit` is unusable too.

### 6.4 [MEDIUM] No lockfile committed anywhere — `.gitignore:89`
A bare `package-lock.json` entry ignores lockfiles at every level; `git ls-files` shows zero tracked lockfiles. Multi-contributor project + EAS cloud builds + no lockfile = non-reproducible builds. Remove the ignore line, commit `frontend/package-lock.json` (and a backend one once deps are installed); delete the root lockfile with the scaffold.

### 6.5 [MEDIUM] Stale READMEs
Both the root README ("Currently a scaffold; no server code yet") and `backend/README.md` ("Status: scaffold only") predate the fully implemented backend (5 commits, merged via PR #52 on 2026-04-26).

### 6.6 [LOW] Assorted
- `.claude/` is untracked and not gitignored; `settings.local.json` is machine-specific and should never be committed — gitignore it.
- Expo template/dev screens ship in the release bundle: `(tabs)/index.tsx` dev menu with a **hardcoded Firestore event id** (`"4zJ8xpbgfd5js5S0l0BV"`, lines 81/91), `trello.tsx` "Trello Integration Test" screen, untouched starter `explore.tsx` and `modal.tsx` — all routable since `(tabs)` and `trello` are in `authRoutes`.
- Dead files: `components/hello-wave.tsx` and `components/ui/start-event-card.tsx` never imported; `scripts/test-trello-integration.ts` is a stub pointing at a test file that doesn't exist (Trello has no runnable test); `scripts/reset-project.js` is deletable template scaffolding.
- Auth-guard inconsistency in `event-service.ts`: `createEvent`/`startEvent`/`updateEventMetrics` check `auth.currentUser`, but `setEventInactive`/`saveDraft`/`publishEvent`/`getDraftEvents`/`getActiveEvent` don't — and no `firestore.rules` in the repo to confirm server-side enforcement.
- `config/firebase.ts`: `@ts-ignore` + `require()`, and a bare `catch {}` around `initializeAuth` that silently downgrades auth persistence on *any* error; no validation that the `EXPO_PUBLIC_FIREBASE_*` vars are set.
- Test scripts: `test-sheets.ts` top-level async with no `.catch`; `test-api.ts` parses `response.json()` before checking `response.ok`.
- `trello-funcs.ts:135`: `createCard` sends the read-only `fields` param in a POST body — a misleading no-op.
- Informational: the reversed Google client IDs in `frontend/app.json`'s scheme array are standard/public — no action needed, but they're tied to specific bundle IDs (see §6.2).

---

## 7. Project status (GitHub, verified via API on 2026-08-06)

- **No open PRs.** All 53 ever opened are merged except two closed ones (#18, #30). Last push to main: **2026-05-09** (end of a 12-PR bugfix sprint — likely end-of-semester handoff).
- **Your local clone is stale:** local `origin/main` is **15 merged PRs behind** GitHub (last local ref 2026-04-29). Run `git fetch --prune`.
- **Stranded work worth salvaging:**
  - `bugfix/move-issue-completed/jai` — 3 commits ahead (last activity 2026-05-08), an in-progress fix for open issue #67 by its assignee that never became a PR. **Most actionable stranded work in the repo.**
  - `feature/metrics-testing/indira-srinidhi-chloe` — 3 commits ahead (2026-04-25), a config-driven metrics UI (~384 insertions) likely superseded by merged PR #61; needs a maintainer call: salvage or delete.
- **Safe to delete:** ~43 remote branches that are fully merged or deliberately abandoned (`feature/trello-confirmation`, `revert-26-*`, `bugfix/hide-draft-in-upcoming-events`); local `test-branch` (1 junk commit) and `pr-18`.
- **Uncommitted working tree:** the `frontend/app.json` Android-package rename (keep, but pair with the iOS fix, §6.2), new `frontend/eas.json` (keep once §6.3 is done), and the stray root scaffold files (delete, §6.1).
