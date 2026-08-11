// One-off migration to the ownership model and the album-title reservation
// scheme. Documents written by the previous code lack fields the new queries
// and firestore.rules depend on:
//
//   events      createdBy / startedBy are absent, so getDraftEvents() and
//               getActiveEvent() match nothing and the rules deny updates.
//               savedAsDraftAt / endDate / startDate must exist (even as null)
//               or orderBy and where("endDate","==",null) silently skip the doc.
//   albums      two different writers produced two different shapes; neither
//               has titleLower.
//   albumTitles does not exist at all, so no existing album title is protected
//               from being duplicated.
//
// Dry-run by default — prints the exact plan and writes nothing. Pass --apply
// to commit. Idempotent: a second run is a no-op. Every update carries a
// lastUpdateTime precondition, so a concurrent write from the live app aborts
// the batch instead of being silently reverted.
//
//   npm run backfill -- --owner you@example.com
//   npm run backfill -- --owner you@example.com --apply
//
// Against the emulator (--owner must be uid:… — real Auth is not reachable):
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8085 npm run backfill -- --owner uid:someone

import "dotenv/config";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import {
    FieldValue,
    getFirestore,
    Timestamp,
    type DocumentData,
    type Firestore,
} from "firebase-admin/firestore";
import { albumTitleKey, normalizeAlbumTitle } from "../src/album-title-key";
import { loadServiceAccount } from "../src/service-account";

const EVENTS = "events";
const ALBUMS = "albums";
const ALBUM_TITLES = "albumTitles";
const BATCH_LIMIT = 400;

// An event started longer ago than this was abandoned, not left running. It
// must not be claimed: getActiveEvent() is (startedBy == uid && endDate == null),
// so claiming it would make it the owner's permanent "active event", and
// hoursOfService is derived from endDate - startDate — pressing Stop would
// record months of service.
const RESUMABLE_MS = 12 * 60 * 60 * 1000;

type Args = { owner: string; apply: boolean };

function parseArgs(): Args {
    const argv = process.argv.slice(2);
    const ownerIndex = argv.indexOf("--owner");
    const owner = ownerIndex >= 0 ? argv[ownerIndex + 1] : undefined;
    // A bare `--owner --apply` would otherwise take "--apply" as the owner AND
    // silently enable apply mode; `--owner uid:` would write "" into createdBy
    // and startedBy on every document scanned.
    if (!owner || owner.startsWith("--") || owner === "uid:") {
        throw new Error(
            "Missing --owner <email|uid:UID>. This account is attributed as " +
                "createdBy on legacy events and albums, and as startedBy on " +
                "events that are still genuinely running or saved as drafts.",
        );
    }
    return { owner, apply: argv.includes("--apply") };
}

type Target = { db: Firestore; projectId: string; isEmulator: boolean };

function initAdmin(): Target {
    const emulator = process.env.FIRESTORE_EMULATOR_HOST;
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    let projectId: string;

    if (emulator) {
        projectId = process.env.GOOGLE_CLOUD_PROJECT ?? "mvt-rules-test";
        if (getApps().length === 0) initializeApp({ projectId });
    } else if (raw) {
        const account = loadServiceAccount(raw, "FIREBASE_SERVICE_ACCOUNT_JSON");
        projectId = account.project_id;
        if (getApps().length === 0) {
            initializeApp({
                credential: cert({
                    projectId: account.project_id,
                    clientEmail: account.client_email,
                    privateKey: account.private_key,
                }),
            });
        }
    } else {
        throw new Error(
            "Set FIREBASE_SERVICE_ACCOUNT_JSON (backend/.env, see .env.example), " +
                "or FIRESTORE_EMULATOR_HOST to run against the emulator.",
        );
    }
    return { db: getFirestore(), projectId, isEmulator: Boolean(emulator) };
}

async function resolveOwnerUid(owner: string, isEmulator: boolean): Promise<string> {
    if (owner.startsWith("uid:")) return owner.slice(4);
    if (isEmulator && !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
        throw new Error(
            `FIRESTORE_EMULATOR_HOST is set, so "${owner}" cannot be looked up in ` +
                `real Firebase Auth. Pass --owner uid:<UID> instead.`,
        );
    }
    const user = await getAuth().getUserByEmail(owner);
    return user.uid;
}

type Change = {
    ref: FirebaseFirestore.DocumentReference;
    data: DocumentData;
    updateTime: Timestamp;
};

type Create = { ref: FirebaseFirestore.DocumentReference; data: DocumentData };

type Plan = {
    changes: Change[];
    creates: Create[];
    notes: string[];
    warnings: string[];
    current: number;
};

const DELETE_MARK = "<delete>";

function describe(value: unknown): string {
    if (value instanceof Timestamp) return value.toDate().toISOString();
    return JSON.stringify(value);
}

function planEvents(
    docs: FirebaseFirestore.QueryDocumentSnapshot[],
    ownerUid: string,
): Plan {
    const changes: Change[] = [];
    const notes: string[] = [];
    const warnings: string[] = [];
    let current = 0;

    for (const snapshot of docs) {
        const data = snapshot.data();
        // Presence, not truthiness: null is a legitimate stored value here and
        // must not be rewritten on a second run.
        const has = (field: string) => Object.hasOwn(data, field);
        const update: DocumentData = {};
        const display: string[] = [];

        const set = (field: string, value: unknown, shown = describe(value)) => {
            update[field] = value;
            display.push(`      + ${field} = ${shown}`);
        };

        const startedAt = data.startDate instanceof Timestamp ? data.startDate : null;
        const endedAt = data.endDate instanceof Timestamp ? data.endDate : null;
        const isDraft = data.isDraft === true;
        const isLiveRun =
            startedAt !== null &&
            endedAt === null &&
            Date.now() - startedAt.toMillis() < RESUMABLE_MS;

        if (!has("createdBy")) set("createdBy", ownerUid);

        if (!has("startedBy")) {
            // Claim only what should still be reachable: a run genuinely in
            // progress, or a draft (getDraftEvents also filters startedBy).
            set("startedBy", isLiveRun || isDraft ? ownerUid : null);
            if (startedAt && endedAt === null && !isLiveRun && !isDraft) {
                warnings.push(
                    `  events/${snapshot.id} "${String(data.title ?? "")}" was started ` +
                        `${Math.round((Date.now() - startedAt.toMillis()) / 86_400_000)}d ago ` +
                        `and never ended — left unclaimed so it cannot become an active event.`,
                );
            }
        }

        // Presence alone is not enough: a legacy document storing a date as a
        // string satisfies has(), keeps the bad value, and is reported as
        // "already current" — while orderBy and where("endDate","==",null)
        // still treat it differently than the new queries expect, and
        // drafts.tsx calls .toDate() on it during render.
        const isNullOrTimestamp = (field: string) =>
            data[field] === null || data[field] instanceof Timestamp;
        if (!has("startDate") || !isNullOrTimestamp("startDate")) {
            set("startDate", startedAt);
        }
        if (!has("endDate") || !isNullOrTimestamp("endDate")) {
            set("endDate", endedAt);
        }

        if (!has("savedAsDraftAt") || !isNullOrTimestamp("savedAsDraftAt")) {
            // orderBy("savedAsDraftAt") drops documents missing the field, so
            // an existing draft would vanish from the Drafts list entirely.
            // Only a real Timestamp is acceptable — drafts.tsx calls .toDate()
            // during render, so a string here white-screens the whole list.
            const fallback = [data.endDate, data.createdAt].find(
                (v) => v instanceof Timestamp,
            ) as Timestamp | undefined;
            set("savedAsDraftAt", isDraft ? (fallback ?? Timestamp.now()) : null);
        }

        if (typeof data.isActive !== "boolean") set("isActive", false);
        if (typeof data.isDraft !== "boolean") set("isDraft", false);

        // Dropped from EventMetrics: it had no input field, so it was never
        // settable and was always 0.
        if (
            data.metrics &&
            typeof data.metrics === "object" &&
            Object.hasOwn(data.metrics, "trailImprovements")
        ) {
            set("metrics.trailImprovements", FieldValue.delete(), DELETE_MARK);
        }

        if (display.length === 0) {
            current++;
            continue;
        }

        notes.push(
            `  events/${snapshot.id}  "${String(data.title ?? "(untitled)").slice(0, 40)}"\n` +
                display.join("\n"),
        );
        changes.push({
            ref: snapshot.ref,
            data: update,
            updateTime: snapshot.updateTime,
        });
    }

    return { changes, creates: [], notes, warnings, current };
}

function planAlbums(
    docs: FirebaseFirestore.QueryDocumentSnapshot[],
    existingTitleKeys: Set<string>,
    albumIdsUsedByEvents: Set<string>,
    ownerUid: string,
    db: Firestore,
): Plan {
    const changes: Change[] = [];
    const creates: Create[] = [];
    const notes: string[] = [];
    const warnings: string[] = [];
    let current = 0;

    // Two legacy albums can normalize to the same key. The first wins the
    // reservation; the rest are reported rather than silently overwritten.
    const claimedKeys = new Map<string, string>();

    for (const snapshot of docs) {
        const data = snapshot.data();
        const has = (field: string) => Object.hasOwn(data, field);
        const update: DocumentData = {};
        const display: string[] = [];

        const title = typeof data.title === "string" ? data.title : "";

        // These run even for an untitled album: without createdBy, the rules
        // deny every update and delete once deployed, freezing the document.
        if (!has("albumId")) update.albumId = snapshot.id;
        if (!has("createdBy")) update.createdBy = ownerUid;
        if (!has("albumUrl")) update.albumUrl = "";
        if (!has("eventId")) update.eventId = null;
        if (title && !has("titleLower")) {
            update.titleLower = normalizeAlbumTitle(title);
        }
        // Deliberately NOT backfilling createdAt: albums.tsx renders it as the
        // album's real creation date, and today's blank is honest where an
        // invented migration timestamp would not be.
        display.push(...Object.keys(update).map((k) => `      + ${k}`));

        if (!title) {
            warnings.push(
                `  albums/${snapshot.id} has no title — fields backfilled, but it gets ` +
                    `NO reservation, so its name is not protected from duplication.`,
            );
        } else {
            const key = albumTitleKey(title);
            const collidesWith = claimedKeys.get(key);
            if (collidesWith) {
                warnings.push(
                    `  albums/${snapshot.id} "${title}" normalizes to the same key as ` +
                        `albums/${collidesWith} (${key}) — only the first is protected.`,
                );
            } else if (existingTitleKeys.has(key)) {
                // Already reserved, by an earlier run or by the live app.
                // Rewriting would reset reservedBy/reservedAt and could stomp
                // an in-flight "pending" reservation.
                claimedKeys.set(key, snapshot.id);
            } else {
                claimedKeys.set(key, snapshot.id);
                // An album that never reached createEvent is the residue of a
                // failed setup, not a finished album. "created" can never be
                // released (firestore.rules allows deleting only "pending"),
                // so marking one "created" would block that title forever —
                // the exact bug the reservation scheme exists to prevent.
                // An event pointing at this album is the strongest evidence
                // setup finished — the legacy album document itself may or may
                // not carry eventId depending on which writer last touched it.
                const looksComplete =
                    albumIdsUsedByEvents.has(snapshot.id) ||
                    Boolean(data.eventId) ||
                    Boolean(data.albumUrl);
                creates.push({
                    ref: db.collection(ALBUM_TITLES).doc(key),
                    data: {
                        titleKey: key,
                        title: title.trim(),
                        titleLower: normalizeAlbumTitle(title),
                        albumId: snapshot.id,
                        reservedBy: ownerUid,
                        reservedAt: Timestamp.now(),
                        status: looksComplete ? "created" : "pending",
                    },
                });
                if (!looksComplete) {
                    warnings.push(
                        `  albums/${snapshot.id} "${title}" has no eventId or albumUrl — ` +
                            `reserved as "pending" (a failed setup), so the title can be reused.`,
                    );
                }
            }
        }

        if (display.length === 0) {
            current++;
            continue;
        }
        notes.push(
            `  albums/${snapshot.id}  "${title.slice(0, 40)}"\n` + display.join("\n"),
        );
        changes.push({
            ref: snapshot.ref,
            data: update,
            updateTime: snapshot.updateTime,
        });
    }

    return { changes, creates, notes, warnings, current };
}

async function commit(
    db: Firestore,
    updates: Change[],
    creates: Create[],
): Promise<void> {
    const total = updates.length + creates.length;
    let committed = 0;

    try {
        for (let i = 0; i < updates.length; i += BATCH_LIMIT) {
            const slice = updates.slice(i, i + BATCH_LIMIT);
            const batch = db.batch();
            for (const change of slice) {
                // Aborts the batch if the live app wrote this document after
                // our scan, rather than silently reverting that write.
                batch.update(change.ref, change.data, {
                    lastUpdateTime: change.updateTime,
                });
            }
            await batch.commit();
            committed += slice.length;
            console.log(`  committed ${committed}/${total}`);
        }

        for (let i = 0; i < creates.length; i += BATCH_LIMIT) {
            const slice = creates.slice(i, i + BATCH_LIMIT);
            const batch = db.batch();
            // create(), not set(merge:true): if the app reserved this title
            // between the scan and now, fail loudly instead of clobbering it.
            for (const change of slice) batch.create(change.ref, change.data);
            await batch.commit();
            committed += slice.length;
            console.log(`  committed ${committed}/${total}`);
        }
    } catch (error) {
        throw new Error(
            `Batch failed after ${committed}/${total} writes — the database is ` +
                `PARTIALLY MIGRATED.\n` +
                `  Do NOT deploy firestore.rules yet.\n` +
                `  Re-run the same command: it re-reads and re-plans, so completed ` +
                `work is skipped.\n` +
                `  Cause: ${error instanceof Error ? error.message : String(error)}`,
        );
    }
}

async function main(): Promise<void> {
    const { owner, apply } = parseArgs();
    const { db, projectId, isEmulator } = initAdmin();
    const ownerUid = await resolveOwnerUid(owner, isEmulator);

    console.log(
        `\nTarget:  ${isEmulator ? `EMULATOR ${process.env.FIRESTORE_EMULATOR_HOST}` : "PRODUCTION Firestore"}`,
    );
    console.log(`Project: ${projectId}`);
    console.log(`Owner:   ${owner} -> ${ownerUid}`);
    console.log(`Mode:    ${apply ? "APPLY (writes)" : "DRY RUN (no writes)"}\n`);

    const [eventDocs, albumDocs, titleDocs] = await Promise.all([
        db.collection(EVENTS).get(),
        db.collection(ALBUMS).get(),
        db.collection(ALBUM_TITLES).get(),
    ]);

    // An empty scan is indistinguishable from a finished migration, and
    // "already migrated" would greenlight the rules deploy against a database
    // that still has none of the required fields.
    if (eventDocs.size === 0 && albumDocs.size === 0) {
        throw new Error(
            `Scanned 0 events and 0 albums in project "${projectId}". Refusing to ` +
                `report success — this is almost certainly the wrong database.`,
        );
    }

    const existingTitleKeys = new Set(titleDocs.docs.map((d) => d.id));
    const albumIdsUsedByEvents = new Set(
        eventDocs.docs
            .map((d) => d.data().albumId)
            .filter((id): id is string => typeof id === "string" && id !== ""),
    );
    const events = planEvents(eventDocs.docs, ownerUid);
    const albums = planAlbums(
        albumDocs.docs,
        existingTitleKeys,
        albumIdsUsedByEvents,
        ownerUid,
        db,
    );

    console.log(`events: ${eventDocs.size} scanned`);
    if (events.notes.length) console.log(events.notes.join("\n"));
    console.log(
        `  -> ${events.changes.length} to update, ${events.current} already current\n`,
    );

    console.log(`albums: ${albumDocs.size} scanned`);
    if (albums.notes.length) console.log(albums.notes.join("\n"));
    console.log(
        `  -> ${albums.changes.length} to update, ${albums.creates.length} reservations to create, ${albums.current} already current\n`,
    );

    const warnings = [...events.warnings, ...albums.warnings];
    if (warnings.length) {
        console.log(`REVIEW THESE (${warnings.length}):`);
        console.log(warnings.join("\n"));
        console.log("");
    }

    const total =
        events.changes.length + albums.changes.length + albums.creates.length;
    if (total === 0) {
        console.log("Nothing to do — already migrated.\n");
        return;
    }

    if (!apply) {
        console.log(
            `DRY RUN — nothing written. Re-run with --apply to commit ${total} write(s).\n`,
        );
        return;
    }

    console.log(`Applying ${total} write(s)...`);
    await commit(db, [...events.changes, ...albums.changes], albums.creates);
    console.log("\nDone. Deploy firestore.rules now — not before.\n");
}

// Only run when invoked directly: album-title-key is imported by tests, and
// importing must never trigger a migration.
if (require.main === module) {
    main().catch((error: unknown) => {
        console.error(
            `\nBackfill failed: ${error instanceof Error ? error.message : String(error)}\n`,
        );
        process.exit(1);
    });
}
