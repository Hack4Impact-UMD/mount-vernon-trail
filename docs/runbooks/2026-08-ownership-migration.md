# Runbook: ownership migration (2026-08)

**Run this once per Firebase project whose data predates the ownership
refactor** (the `stack/01`–`stack/16` series). In practice that is the shared
`friends-of-mvt` project, once, when this refactor is deployed: whoever deploys
it runs this as part of the release. You also need it if you restore a backup
taken before the migration, or point the app at another project seeded with
pre-refactor data.

You do **not** need it to set up a development machine. It writes to the live
shared project, and it needs admin access there (Firebase credentials for the
backend scripts, and permission to deploy rules).

## Steps

Documents written before the ownership refactor lack fields the new queries and
rules require. **Order matters** — rules deployed before the backfill would lock
users out of their own existing events.

```bash
# 0. Back up. Writes a local JSON snapshot of events/albums/albumTitles.
cd backend && npm run snapshot -- backup

# 1. Indexes, and wait until every one reports READY.
npx firebase deploy --only firestore:indexes
npx firebase firestore:indexes

# 2. Backfill. Dry-run prints the exact plan and writes nothing.
cd backend
npm run backfill -- --owner you@example.com            # review the plan
npm run backfill -- --owner you@example.com --apply

# 3. Grant yourself admin, then sign out and back in.
npm run set-admin -- you@example.com

# 4. Rules LAST.
cd .. && npx firebase deploy --only firestore:rules
```

`--owner` is attributed as `createdBy` on legacy events and albums, and as
`startedBy` on events that were already running — the app has no record of who
originally created them. The backfill is idempotent, so a second run is a no-op.

Read the dry run's `REVIEW THESE` section before applying. It flags events that
were started but never ended (left unclaimed, so they cannot become a bogus
active event), albums whose titles collide onto one reservation key, and albums
with no linked event — reserved as `pending` rather than `created`, so their
title stays reusable.

To roll back:

```bash
cd backend
npm run snapshot -- restore backups/firestore-<stamp>.json          # dry run
npm run snapshot -- restore backups/firestore-<stamp>.json --apply
```

Restore rewrites each document to exactly its backed-up state, reverting every
field the migration added. It never deletes, so `albumTitles` documents created
by the migration remain — harmless, since the old code never reads them. This
round-trip is exercised against the emulator, not just written.

`firestore.indexes.json` intentionally retains the older `isDraft +
savedAsDraftAt` index alongside the new three-field one, so the deploy is purely
additive and a rollback to the previous app still has its index.

## Run log

Add a line when this is run against a project, so nobody has to guess whether
it has been done.

| Date | Project | Run by | Notes |
|---|---|---|---|
