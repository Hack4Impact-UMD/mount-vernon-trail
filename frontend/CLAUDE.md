# frontend/ — Expo app

Expo ~54, React Native 0.81, React 19.1, expo-router 6, TypeScript strict,
`@/*` path alias mapped to this directory. See the root
[CLAUDE.md](../CLAUDE.md) for the data model and cross-package context.

```bash
npm start          # expo start
npm run ios        # expo run:ios
npm run android    # expo run:android
npm run typecheck  # tsc --noEmit
npm run lint       # eslint .
npm test           # jest — 66 tests, ~1s
npm run format     # prettier --write .
```

There is no `build` script; native and cloud builds go through EAS profiles in
[eas.json](eas.json).

## Adding a screen — read this first

Routing is **flat** file-based over the 14 files in [app/](app/). No route
groups, no dynamic segments. Screen state travels as **query params** via
`useLocalSearchParams`, not path segments.

**Every new screen in `app/` must also be added to `AUTH_ROUTES` in
[app/_layout.tsx](app/_layout.tsx), or a signed-in user who navigates to it is
silently bounced back to `/home-screen`.** There is no error and nothing in the
console — the screen just never appears. This is the single most common way to
break this app.

`index` is deliberately absent from that list; that omission is what makes `/`
forward to `/home-screen`.

The gate itself: `user === undefined` means auth is still initializing, `null`
means signed out, a `User` means signed in. Signed out and not in
`NON_AUTH_ROUTES` → `/auth`. Signed in and not in `AUTH_ROUTES` → `/home-screen`.

## State

**There is no global state library** — no Redux, zustand, jotai or MobX, and no
`store/` directory. Do not add one without a strong reason. State is three things
plus per-screen `useState`:

1. **`AuthProvider` context** — [auth/auth-context.tsx](auth/auth-context.tsx).
   The app-wide auth subscription. Read it with `useAuth()`.
2. **The photo queue** — [services/photo-queue.ts](services/photo-queue.ts). A
   module-level pub/sub store persisted to AsyncStorage under `photo-queue:v1`.
   Bridged to React by [hooks/use-photo-queue.ts](hooks/use-photo-queue.ts).
3. **The Trello id cache** — [services/trello-config.ts](services/trello-config.ts).
   15-minute TTL, single-flighted, invalidated on `TrelloAuthError`.

## Reuse these — do not re-implement

| Need | Use | From |
|---|---|---|
| Firestore / auth handle | `db`, `auth`, `firebaseApp` | [config/firebase.ts](config/firebase.ts) |
| Error message from `unknown` | `getErrorMessage` | [utils/errors.ts](utils/errors.ts) |
| Signed-in guard | `requireUser` | [services/require-user.ts](services/require-user.ts) |
| Colors | `Palette` | [constants/theme.ts](constants/theme.ts) |
| Date parse / format | `parseAndValidateDate`, `getDateString` | [utils/date.ts](utils/date.ts) |
| Anything Google Photos | the backend client | [api/backend-client.ts](api/backend-client.ts) |

[config/firebase.ts](config/firebase.ts) is the **only** place Firebase is
initialized. Never call `getFirestore()` again — import `db`. Note that this
module **throws at import time** if any `EXPO_PUBLIC_FIREBASE_*` var is missing,
which is why tests mock it and why CI passes dummy values.

[api/backend-client.ts](api/backend-client.ts) is the **only** route to Google
Photos. Never call `photoslibrary.googleapis.com` from the app — the whole point
of the proxy is that photos land in the MVT account, not a volunteer's personal
library. The client attaches the Firebase ID token and retries exactly once on a
401 with a force-refreshed token, rebuilding the multipart body because a consumed
stream cannot be replayed.

`Palette` is the source of truth for color. Several screens still hardcode hex
(`event-summary.tsx` has its own `PURPLE`); prefer `Palette` in new code.

## Photo queue semantics

Capture must never block on the network — volunteers work in spotty riverside
coverage. A photo is written to the queue the moment it is taken and uploaded
opportunistically, again when the event stops.

Photo ids are deterministic: `${eventId}:${issueId}:${slot}`. Retaking a photo
therefore **replaces** the queued entry rather than accumulating duplicates. Keep
that property if you touch the id scheme.

## Conventions actually used here

- **Filenames are kebab-case throughout**, including components:
  `trail-event-card.tsx`, `use-photo-queue.ts`. No PascalCase filenames.
- Symbols are PascalCase and often differ from the filename (`header.tsx` exports
  `HomeHeader`). Most `components/ui/*` default-export; three named-export
  (`PastEventsCard`, `TrailDocIssuesCard`, `UpcomingEventsCard`).
- **Styling is `StyleSheet.create` only.** No NativeWind, no Tailwind, no
  styled-components, no `className`. Do not introduce one.
- `type` strongly preferred over `interface` (`interface` survives only in
  `services/trello-types.ts` and some older prop types).
- `any` is close to eliminated — keep it that way. Catch as
  `catch (error: unknown)` and funnel through `getErrorMessage`.
- One typed error class per domain: `AuthError`, `TrelloAuthError`,
  `BackendError`, `EventSetupError`. Each sets `this.name`.
- `@/` for cross-directory imports, `./` for siblings.

## Tests

Tests live in `__tests__/` next to the source they cover. `jest-expo` preset.

[jest.setup.js](jest.setup.js) mocks `@/config/firebase` (which throws on missing
env) and every native module with no JS implementation under the test runtime. **A
new native dependency usually needs a mock added there**, or unrelated suites start
failing at import.

Existing coverage: `api/__tests__/backend-client.test.ts`,
`services/__tests__/event-service.test.ts`,
`services/__tests__/photo-queue.test.ts`,
`services/__tests__/album-service.test.ts`,
`components/ui/__tests__/trail-metrics-section.test.tsx`.

`album-service.test.ts` loads
[../album-title-test-vectors.json](../album-title-test-vectors.json) — a shared
contract with the backend. See [../backend/CLAUDE.md](../backend/CLAUDE.md).

## Dead code — do not mistake these for live paths

- [services/google-photos-api-service.ts](services/google-photos-api-service.ts)
  has **zero importers** and still uses the retired `x-api-key` scheme against an
  env var that is not in `.env.example`. It is a leftover, not the upload path.
- [profile-pictures/](profile-pictures/) is team headshots for the root README.
  No code references it; it is not an app asset directory.

## Config

All runtime config is `EXPO_PUBLIC_*` and therefore **inlined into the shipped JS
bundle** — never put a secret in `.env`. See [.env.example](.env.example), which
documents every variable.

Local `.env` is **not** uploaded to EAS. Cloud builds read the expo.dev
environment matching the profile in [eas.json](eas.json); a variable missing there
ships as undefined and the app throws at startup from `config/firebase.ts`.
