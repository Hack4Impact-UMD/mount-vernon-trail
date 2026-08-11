# CLAUDE.md

Guidance for Claude Code working in this repo.

## What this is

The **Friends of the Mount Vernon Trail** volunteer app (Hack4Impact-UMD). During
a Saturday work event a volunteer documents each trail issue: photograph the
problem, fix it, photograph it again, record metrics, then publish a summary to
Trello.

The before/after photos land in **one shared Google Photos album owned by the MVT
account** — not in any volunteer's personal library. That single requirement is
why `backend/` exists: the app has no Google Photos credentials and reaches the
album only through our own proxy.

## Repo shape

Three **independent** npm packages. There is no root `package.json` and no
workspace config — `npm test` at the repo root does nothing. Always `cd` into a
package first.

| Path | What | Nested guidance |
|---|---|---|
| `frontend/` | Expo / React Native app | [frontend/CLAUDE.md](frontend/CLAUDE.md) |
| `backend/` | Express proxy to Google Photos | [backend/CLAUDE.md](backend/CLAUDE.md) |
| `firestore/` | Emulator tests for `firestore.rules` | [firestore/CLAUDE.md](firestore/CLAUDE.md) |

Cross-package flows (event setup saga, photo pipeline, event lifecycle) are in
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Commands

Run every gate the package actually has, exactly as CI does on each PR.

```bash
cd frontend  && npm run typecheck && npm run lint && npm test   # 66 tests, ~1s
cd backend   && npm run typecheck && npm run lint && npm test   # 91 tests, minutes on a cold cache
cd firestore && npm run typecheck && npm test                   # 35 tests, ~3s + emulator boot
```

`firestore/` has no `lint` script — it is two gates there, not three.

Two things that will otherwise waste your time:

- **The backend suite can take several minutes.** It is CPU-bound, not waiting on
  anything: `jest.config.js` uses the `ts-jest` preset, so every suite is
  typechecked as it is transformed. The first run after a fresh clone or a cleared
  jest cache is the slow one; later runs are far quicker. It is not hung — do not
  kill it.
- **The rules suite starts and stops its own emulator** via
  `firebase emulators:exec`. Do not launch an emulator by hand; you will get a
  port conflict. It needs Java, no credentials, and no live Firebase project.

CI is [.github/workflows/ci.yml](.github/workflows/ci.yml) — three independent
jobs on every pull request and every push to `main`, Node 22, plus Temurin 17 for
the rules job. The backend job also runs `npm run build`.

## The three systems

One user flow spans three backends, each reached a different way:

| System | How it is reached | Enforced by |
|---|---|---|
| **Firestore** | directly from the device, Firebase web SDK v11 | [firestore.rules](firestore.rules) |
| **Google Photos** | only via `backend/`, never directly | Firebase ID token, then the MVT refresh token |
| **Trello** | directly from the device, per-volunteer OAuth token | Trello |

## Data model

Three collections. Types live in
[frontend/services/event-service.ts](frontend/services/event-service.ts) and
[frontend/services/album-service.ts](frontend/services/album-service.ts).

**`events/{eventId}`** — `eventId`, `title`, `description`, `date`,
`trelloCardId`, `albumId`, `albumUrl`, `createdBy` (the admin who set it up),
`startedBy` (the volunteer running it, `null` until claimed), `startDate`,
`endDate`, `isActive`, `isDraft`, `savedAsDraftAt`, `publishedAt?`, `createdAt`,
`eventLeader`, `zoneLeaders`, `toolHaulers`, `gloverLover`, `notes`, `metrics?`.

`createdBy` and `startedBy` are deliberately separate people.

**`EventMetrics`** is exactly 15 numeric keys: `drainageCleaned`,
`graffitiTagsRemoved`, `stickersRemoved`, `otherImprovements`, `itemsPainted`,
`pressureWashed`, `itemsRepaired`, `safetyImprovements`, `snowRemovalEvents`,
`potholesFilled`, `trailEdgedFeet`, `trashBagsCollected`, `trashPoundsCollected`,
`treesTrimmed`, `vegetationVolunteers`. Every key must have a matching input in
`components/ui/trail-metrics-section.tsx` — a test asserts it.

`hoursOfService` is **derived** from `endDate - startDate` by
`extractMetricsWithHours`, never stored. `endDate` is written exactly once, when
the event ends; `saveDraft` and `publishEvent` must never touch it, or re-saving a
draft inflates the hours.

**`albums/{albumId}`** — `albumId`, `title`, `titleLower`, `albumUrl`, `eventId`,
`createdBy`, `createdAt`.

**`albumTitles/{titleKey}`** — `titleKey`, `title`, `titleLower`, `albumId`,
`reservedBy`, `reservedAt`, `status` (`"pending" | "created"`). The document id is
deterministic, which is what makes the duplicate-title check atomic.

## Security boundary

**[firestore.rules](firestore.rules) is the only real enforcement.**
`requireUser()` in
[frontend/services/require-user.ts](frontend/services/require-user.ts) is a UX
guard that produces a friendly error — it is not a security control. Never rely on
a client-side check to protect data.

There is exactly one custom claim, `admin`:

```bash
cd backend && npm run set-admin -- you@example.com
```

Sign out and back in afterwards — ID tokens cache claims for up to an hour, so the
claim does not take effect until the token is reissued.

## Firestore indexes

Any new **compound** query (a `where` plus an `orderBy`, or two `where`s on
different fields) needs an entry in
[firestore.indexes.json](firestore.indexes.json) or it throws
`failed-precondition` in a fresh environment. Three exist today, all on `events`:

- `startedBy, endDate, startDate desc` — backs `getActiveEvent()`
- `isDraft, startedBy, savedAsDraftAt desc` — backs `getDraftEvents()`
- `isDraft, savedAsDraftAt desc` — retained from the pre-ownership schema so a
  rollback still has its index

Deploy with `npx firebase deploy --only firestore:indexes` and wait for every
index to report `READY` **before** deploying rules. Check readiness with
`npx firebase firestore:indexes --pretty` — **the `--pretty` flag is required**,
because the default JSON output omits the `state` field entirely and so lists a
still-building index indistinguishably from a ready one.

## Which docs to trust

| Doc | Status |
|---|---|
| [README.md](README.md) | Current — setup, migration runbook, git procedures |
| [backend/README.md](backend/README.md) | Current — endpoint table, OAuth linking, deployment |
| [MANUAL_TEST_PLAN.md](MANUAL_TEST_PLAN.md) | Current — the flows needing real credentials |
| [PROJECT_AUDIT.md](PROJECT_AUDIT.md) | **Historical (2026-08-06)** — describes the pre-refactor code |
| [FEATURE_PROPOSALS.md](FEATURE_PROPOSALS.md) | **Historical (2026-08-06)** — premises partly obsolete |

The audit and the proposals were written before the `stack/01`–`stack/15` refactor
series. Most of the audit's findings are fixed, and the proposals' top-ranked
feature is built on a Google Sheets client that has since been deleted. Both carry
a banner saying so. **Do not treat either as a current to-do list** — check the
code before acting on anything in them.

## Conventions

The root [.prettierrc](.prettierrc) governs all three packages: 4-space indent,
double quotes, semicolons, `bracketSameLine: true`, `singleAttributePerLine: true`.
A few older files (`frontend/constants/theme.ts`, `frontend/app/camera-view.tsx`)
predate it and are unformatted — leave them unless you are already editing them.

- `type` over `interface`; no `enum` — use string literal unions.
- `catch (error: unknown)`, then a shared error helper. Never swallow an exception.
- One typed error class per domain rather than generic `Error`.
- Comments explain **why**, and often name the bug they fixed. Match that register;
  do not add narration that restates the code.
- Branches are `feature/...` or `bugfix/...`. Never commit to `main`.
- PR reviewers: `bsthapar`, `asea-aranion`.

Run all three gates before opening a PR.
