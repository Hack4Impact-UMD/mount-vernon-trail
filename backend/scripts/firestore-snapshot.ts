// Local backup/restore for the collections the ownership migration touches.
//
// A managed `gcloud firestore export` is the heavier, more general tool, but it
// needs the Cloud SDK and a GCS bucket. These collections are small and we only
// need to undo one migration, so a scoped local snapshot is a better fit — and
// unlike an export, the restore path here is exercised before it is needed.
//
//   npm run snapshot -- backup
//   npm run snapshot -- restore backups/firestore-<stamp>.json          # dry run
//   npm run snapshot -- restore backups/firestore-<stamp>.json --apply
//
// Restore rewrites each document to exactly its backed-up state, which reverts
// every field the migration added. Documents created AFTER the backup are left
// alone and reported — restore never deletes.

import "dotenv/config";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import {
    getFirestore,
    Timestamp,
    type DocumentData,
    type Firestore,
} from "firebase-admin/firestore";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import { loadServiceAccount } from "../src/service-account";

const COLLECTIONS = ["events", "albums", "albumTitles"] as const;
const BATCH_LIMIT = 400;

type Snapshot = {
    project: string;
    takenAt: string;
    collections: Record<string, Record<string, DocumentData>>;
};

// JSON has no Timestamp, and losing them would silently turn every date into a
// plain object on restore.
function encode(value: unknown): unknown {
    if (value instanceof Timestamp) {
        return { __ts__: value.toMillis() };
    }
    if (Array.isArray(value)) return value.map(encode);
    if (value && typeof value === "object") {
        return Object.fromEntries(
            Object.entries(value as Record<string, unknown>).map(([k, v]) => [
                k,
                encode(v),
            ]),
        );
    }
    return value;
}

function decode(value: unknown): unknown {
    if (value && typeof value === "object" && !Array.isArray(value)) {
        const record = value as Record<string, unknown>;
        if (typeof record.__ts__ === "number") {
            return Timestamp.fromMillis(record.__ts__);
        }
        return Object.fromEntries(
            Object.entries(record).map(([k, v]) => [k, decode(v)]),
        );
    }
    if (Array.isArray(value)) return value.map(decode);
    return value;
}

function init(): { db: Firestore; projectId: string } {
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
            "Set FIREBASE_SERVICE_ACCOUNT_JSON in backend/.env, or " +
                "FIRESTORE_EMULATOR_HOST to target the emulator.",
        );
    }
    return { db: getFirestore(), projectId };
}

async function backup(db: Firestore, projectId: string): Promise<void> {
    const snapshot: Snapshot = {
        project: projectId,
        takenAt: new Date().toISOString(),
        collections: {},
    };

    let total = 0;
    for (const name of COLLECTIONS) {
        const docs = await db.collection(name).get();
        snapshot.collections[name] = {};
        for (const doc of docs.docs) {
            snapshot.collections[name][doc.id] = encode(doc.data()) as DocumentData;
        }
        total += docs.size;
        console.log(`  ${name}: ${docs.size}`);
    }

    if (total === 0) {
        throw new Error(
            `All three collections are empty in project "${projectId}". Refusing ` +
                `to write an empty backup — this is almost certainly the wrong database.`,
        );
    }

    const stamp = snapshot.takenAt.replace(/[:.]/g, "-");
    const path = resolve(__dirname, `../backups/firestore-${stamp}.json`);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(snapshot, null, 2));

    console.log(`\nWrote ${total} documents to:\n  ${path}\n`);
    console.log(`Restore with:\n  npm run snapshot -- restore ${path} --apply\n`);
}

async function restore(
    db: Firestore,
    projectId: string,
    file: string,
    apply: boolean,
): Promise<void> {
    const snapshot = JSON.parse(readFileSync(resolve(file), "utf8")) as Snapshot;

    if (snapshot.project !== projectId) {
        throw new Error(
            `Backup is from project "${snapshot.project}" but you are connected to ` +
                `"${projectId}". Refusing to restore across projects.`,
        );
    }

    console.log(`Backup taken ${snapshot.takenAt} from ${snapshot.project}\n`);

    const writes: { ref: FirebaseFirestore.DocumentReference; data: DocumentData }[] =
        [];
    for (const name of COLLECTIONS) {
        const saved = snapshot.collections[name] ?? {};
        const live = await db.collection(name).get();
        const liveIds = new Set(live.docs.map((d) => d.id));
        const savedIds = new Set(Object.keys(saved));

        for (const [id, data] of Object.entries(saved)) {
            writes.push({
                ref: db.collection(name).doc(id),
                data: decode(data) as DocumentData,
            });
        }

        const newSinceBackup = [...liveIds].filter((id) => !savedIds.has(id));
        console.log(
            `  ${name}: ${savedIds.size} to restore` +
                (newSinceBackup.length
                    ? `, ${newSinceBackup.length} created since the backup and LEFT ALONE (${newSinceBackup.join(", ")})`
                    : ""),
        );
    }

    if (!apply) {
        console.log(
            `\nDRY RUN — nothing written. Re-run with --apply to restore ${writes.length} document(s).\n`,
        );
        return;
    }

    for (let i = 0; i < writes.length; i += BATCH_LIMIT) {
        const batch = db.batch();
        // Full overwrite, not merge: that is what reverts fields the migration
        // added.
        for (const w of writes.slice(i, i + BATCH_LIMIT)) batch.set(w.ref, w.data);
        await batch.commit();
        console.log(`  restored ${Math.min(i + BATCH_LIMIT, writes.length)}/${writes.length}`);
    }
    console.log("\nRestore complete.\n");
}

async function main(): Promise<void> {
    const [command, ...rest] = process.argv.slice(2);
    const { db, projectId } = init();
    const target = process.env.FIRESTORE_EMULATOR_HOST
        ? `EMULATOR ${process.env.FIRESTORE_EMULATOR_HOST}`
        : "PRODUCTION";

    console.log(`\nTarget:  ${target}\nProject: ${projectId}\n`);

    if (command === "backup") {
        await backup(db, projectId);
        return;
    }
    if (command === "restore") {
        const file = rest.find((a) => !a.startsWith("--"));
        if (!file) throw new Error("Usage: restore <backup-file.json> [--apply]");
        await restore(db, projectId, file, rest.includes("--apply"));
        return;
    }
    throw new Error("Usage: npm run snapshot -- <backup|restore> [args]");
}

main().catch((error: unknown) => {
    console.error(
        `\nSnapshot failed: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exit(1);
});
