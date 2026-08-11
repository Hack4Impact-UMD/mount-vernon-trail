# firestore/ — security rules tests

**This package contains no application code.** It exists only to test
[../firestore.rules](../firestore.rules), which lives at the repo root alongside
[../firestore.indexes.json](../firestore.indexes.json) and
[../firebase.json](../firebase.json).

```bash
npm test        # 35 tests, ~3s plus emulator boot
npm run typecheck
```

`npm test` runs `firebase emulators:exec`, which **boots the Firestore emulator,
runs jest against it, and shuts it down**. Do not start an emulator yourself —
you will get a port conflict on 8085.

Requirements: **Java** (the emulator is a Java process; CI installs Temurin 17).
No credentials, no live Firebase project — it runs against the throwaway project
id `mvt-rules-test`. `firebase-tools` is a local devDependency, so use
`npx firebase`, not a global install.

`jest.config.js` sets `maxWorkers: 1` because emulator state is shared across
tests. Keep it — parallel workers will clobber each other's fixtures.

## The rules model

Helpers in [../firestore.rules](../firestore.rules): `isSignedIn()`, `isAdmin()`
(the `admin` custom claim), and `changed()` (which keys a write touches).

**`/events/{eventId}`**
- **read** — any signed-in user. Deliberate: the home-screen pre-start modal must
  read an admin-created event the volunteer has never touched.
- **create** — admin only, must self-attribute `createdBy`, and the event must be
  unstarted (`startedBy`, `startDate`, `endDate` all null).
- **update (claim)** — any signed-in user may claim an **unclaimed** event, and
  only by setting `startDate`, `startedBy`, `isActive` with `startedBy` as
  themselves. This is how a volunteer starts an event.
- **update (running)** — the admin or the volunteer in `startedBy`, restricted to
  `metrics`, `notepad`, `notes`, `isActive`, `isDraft`, `endDate`,
  `savedAsDraftAt`, `publishedAt`. `createdBy` and `startedBy` can never be
  rewritten, and neither can `title`.
- **delete** — denied for everyone, including admins.

**`/albums/{albumId}`** — signed-in read; create/update/delete by the **owning
admin** only (`createdBy == request.auth.uid`).

**`/albumTitles/{titleKey}`** — signed-in read; an admin reserves as `pending`;
only the holder may finalize to `created`; a `pending` reservation can be released
but a `created` one is permanent, which is what keeps album titles unique forever.

Everything else is denied by a catch-all `match /{document=**}`.

Dotted writes like `metrics.trashBagsCollected` report to the rules as the single
affected key `metrics` — that is why the update rule lists `metrics` and not each
metric.

`notepad` in that allowlist is a leftover: the field was merged into `notes` and
nothing in the app writes it any more. An allowed key nobody sends costs nothing,
so it stays rather than being removed in a rules change nobody needs.

## Rule for changes

**Any change to `firestore.rules` gets a test here.** This suite is the only thing
between a rules edit and locking every volunteer out of production. Add the
positive case *and* the denial case — most of the existing 35 tests are denials.

Test identities are set up in [__tests__/rules.test.ts](__tests__/rules.test.ts):
`admin-uid`, `other-admin-uid`, `volunteer-uid`, `stranger-uid`. `admin()` uses
`authenticatedContext(uid, { admin: true })`; seed fixtures through
`withSecurityRulesDisabled`.

## Known stale comment

The header of [../firestore.rules](../firestore.rules) says to test with
`firebase emulators:exec --only firestore,auth "npm run test:rules"`. There is no
`test:rules` script anywhere, and the real command uses `--only firestore` (no auth
emulator — `@firebase/rules-unit-testing` mints auth contexts locally). The
`package.json` script is the truth.

## Deploying

From the repo root, indexes first and only then rules — rules deployed ahead of a
backfill can lock users out of their own existing events:

```bash
npx firebase deploy --only firestore:indexes
npx firebase firestore:indexes --pretty   # wait for every index to report READY
npx firebase deploy --only firestore:rules
```

**`--pretty` is not cosmetic — it is the whole point of that middle line.** Without
it the CLI prints `{collectionGroup, queryScope, fields}` per index and drops
`state` altogether, so a `CREATING` index is indistinguishable from a `READY` one
and you will deploy rules early against indexes that do not exist yet.
