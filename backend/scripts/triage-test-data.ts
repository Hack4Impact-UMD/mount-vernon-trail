// Classifies events and albums as likely development artifacts vs real data,
// and writes a reviewable plan. DELETES NOTHING on its own.
//
//   npm run triage                          # writes triage-plan.json + a summary
//   npm run triage -- --delete plan.json    # dry run of the deletions in that file
//   npm run triage -- --delete plan.json --apply
//
// The deletion pass reads document ids from the plan file, so whatever you
// leave in it is exactly what gets deleted — edit the file to override any
// classification. Nothing is inferred a second time.
//
// Deliberately conservative: anything carrying evidence of real use (non-zero
// metrics, a notepad, a published date, a date-prefixed title) is KEPT even if
// its name looks like a test.

import "dotenv/config";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import {
    getFirestore,
    Timestamp,
    type DocumentData,
    type Firestore,
} from "firebase-admin/firestore";
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { loadServiceAccount } from "../src/service-account";

const BATCH_LIMIT = 400;

// Trello event cards are named "M/D/YY Title", and setup-event copies that in.
// A date prefix is the strongest signal of a genuinely scheduled event.
const DATE_PREFIX = /^\d{1,2}\/\d{1,2}\/\d{2,4}\b/;

const TEST_PATTERNS: { re: RegExp; why: string }[] = [
    { re: /\btest\b|^test|test$|testing/i, why: 'contains "test"' },
    { re: /^\d+\.\d+(\.\d+)?\b/, why: "version-number title" },
    { re: /^(a+|b|e|w|x|y|z|hi+|yay|yes|no|asdf|qwerty|hello)$/i, why: "throwaway title" },
    { re: /^.{1,3}$/, why: "title under 4 characters" },
    { re: /\bfix\b|\bagain\b|\brefresh\b|\bdemo\b|\bsample\b|\bfoo\b|\bbar\b/i, why: "developer wording" },
    { re: /^TESTHELLO$/i, why: "throwaway title" },
];

type Verdict = { isTest: boolean; reasons: string[]; keepReasons: string[] };

function classifyEvent(data: DocumentData): Verdict {
    const title = typeof data.title === "string" ? data.title : "";
    const reasons: string[] = [];
    const keepReasons: string[] = [];

    for (const { re, why } of TEST_PATTERNS) {
        if (re.test(title.trim()) && !reasons.includes(why)) reasons.push(why);
    }

    // Evidence of genuine use always wins over a suspicious name.
    if (DATE_PREFIX.test(title.trim())) keepReasons.push("date-prefixed title");
    if (data.publishedAt instanceof Timestamp) keepReasons.push("was published");
    const metrics = (data.metrics ?? {}) as Record<string, unknown>;
    const nonZero = Object.entries(metrics).filter(
        ([, v]) => typeof v === "number" && v > 0,
    );
    if (nonZero.length > 0) {
        keepReasons.push(`${nonZero.length} non-zero metric(s)`);
    }
    if (typeof data.notepad === "string" && data.notepad.trim().length > 10) {
        keepReasons.push("has notepad text");
    }

    return {
        isTest: reasons.length > 0 && keepReasons.length === 0,
        reasons,
        keepReasons,
    };
}

function init(): { db: Firestore; projectId: string } {
    const emulator = process.env.FIRESTORE_EMULATOR_HOST;
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (emulator) {
        const projectId = process.env.GOOGLE_CLOUD_PROJECT ?? "mvt-rules-test";
        if (!getApps().length) initializeApp({ projectId });
        return { db: getFirestore(), projectId };
    }
    if (!raw) throw new Error("Set FIREBASE_SERVICE_ACCOUNT_JSON in backend/.env.");
    const account = loadServiceAccount(raw, "FIREBASE_SERVICE_ACCOUNT_JSON");
    if (!getApps().length) {
        initializeApp({
            credential: cert({
                projectId: account.project_id,
                clientEmail: account.client_email,
                privateKey: account.private_key,
            }),
        });
    }
    return { db: getFirestore(), projectId: account.project_id };
}

type PlanEntry = {
    id: string;
    title: string;
    reasons: string[];
    albumId?: string;
};

type TriagePlan = {
    project: string;
    generatedAt: string;
    deleteEvents: PlanEntry[];
    deleteAlbums: PlanEntry[];
    keptDespiteSuspiciousName: PlanEntry[];
};

async function triage(
    db: Firestore,
    projectId: string,
    aggressive: boolean,
): Promise<void> {
    const [eventDocs, albumDocs] = await Promise.all([
        db.collection("events").get(),
        db.collection("albums").get(),
    ]);

    const deleteEvents: PlanEntry[] = [];
    const kept: PlanEntry[] = [];
    const doomedAlbumIds = new Set<string>();

    for (const snapshot of eventDocs.docs) {
        const data = snapshot.data();
        const title = typeof data.title === "string" ? data.title : "(untitled)";
        const verdict = classifyEvent(data);

        // Aggressive: the Trello card naming convention ("M/D/YY Title") is the
        // only reliable marker of a genuinely scheduled event in this database.
        // Everything else is development and demo data.
        if (aggressive) {
            if (!DATE_PREFIX.test(title.trim())) {
                deleteEvents.push({
                    id: snapshot.id,
                    title,
                    reasons: ["not a date-prefixed scheduled event"],
                    albumId:
                        typeof data.albumId === "string" ? data.albumId : undefined,
                });
                if (typeof data.albumId === "string") doomedAlbumIds.add(data.albumId);
            }
            continue;
        }

        if (verdict.isTest) {
            deleteEvents.push({
                id: snapshot.id,
                title,
                reasons: verdict.reasons,
                albumId: typeof data.albumId === "string" ? data.albumId : undefined,
            });
            if (typeof data.albumId === "string") doomedAlbumIds.add(data.albumId);
        } else if (verdict.reasons.length > 0) {
            kept.push({
                id: snapshot.id,
                title,
                reasons: [`KEPT: ${verdict.keepReasons.join(", ")}`, ...verdict.reasons],
            });
        }
    }

    // An album is deleted only alongside its event, or if it is an orphan whose
    // own name looks like a test. Albums referenced by a surviving event stay.
    const liveAlbumIds = new Set(
        eventDocs.docs
            .filter((d) => !deleteEvents.some((e) => e.id === d.id))
            .map((d) => d.data().albumId)
            .filter((id): id is string => typeof id === "string"),
    );

    const deleteAlbums: PlanEntry[] = [];
    for (const snapshot of albumDocs.docs) {
        const data = snapshot.data();
        const title = typeof data.title === "string" ? data.title : "(untitled)";
        if (liveAlbumIds.has(snapshot.id)) continue;

        if (doomedAlbumIds.has(snapshot.id)) {
            deleteAlbums.push({
                id: snapshot.id,
                title,
                reasons: ["belongs to a deleted test event"],
            });
            continue;
        }
        // Aggressive: anything not attached to a surviving event goes.
        if (aggressive) {
            deleteAlbums.push({
                id: snapshot.id,
                title,
                reasons: ["not attached to a surviving event"],
            });
            continue;
        }
        const verdict = classifyEvent({ title });
        if (verdict.isTest) {
            deleteAlbums.push({
                id: snapshot.id,
                title,
                reasons: ["orphan album, test-looking name", ...verdict.reasons],
            });
        }
    }

    const plan: TriagePlan = {
        project: projectId,
        generatedAt: new Date().toISOString(),
        deleteEvents,
        deleteAlbums,
        keptDespiteSuspiciousName: kept,
    };

    const path = resolve(__dirname, "../triage-plan.json");
    writeFileSync(path, JSON.stringify(plan, null, 2));

    console.log(`events: ${eventDocs.size} scanned`);
    console.log(`  -> ${deleteEvents.length} classified as test data`);
    console.log(`  -> ${eventDocs.size - deleteEvents.length} kept`);
    console.log(`albums: ${albumDocs.size} scanned`);
    console.log(`  -> ${deleteAlbums.length} classified as test data`);
    console.log(`  -> ${albumDocs.size - deleteAlbums.length} kept\n`);

    if (kept.length) {
        console.log(
            `${kept.length} had a test-looking name but were KEPT because they show real use:`,
        );
        for (const k of kept) console.log(`  "${k.title}" — ${k.reasons[0]}`);
        console.log("");
    }

    console.log(`Plan written to:\n  ${path}\n`);
    console.log(
        `Review it, delete any entry you want to SPARE, then:\n` +
            `  npm run triage -- --delete ${path}\n`,
    );
}

async function runDeletion(
    db: Firestore,
    projectId: string,
    file: string,
    apply: boolean,
): Promise<void> {
    const plan = JSON.parse(readFileSync(resolve(file), "utf8")) as TriagePlan;
    if (plan.project !== projectId) {
        throw new Error(
            `Plan is for project "${plan.project}" but you are connected to "${projectId}".`,
        );
    }

    const refs = [
        ...plan.deleteEvents.map((e) => db.collection("events").doc(e.id)),
        ...plan.deleteAlbums.map((a) => db.collection("albums").doc(a.id)),
    ];

    console.log(
        `Plan generated ${plan.generatedAt}\n` +
            `  ${plan.deleteEvents.length} events\n` +
            `  ${plan.deleteAlbums.length} albums\n` +
            `  ${refs.length} documents total\n`,
    );

    if (!apply) {
        console.log("DRY RUN — nothing deleted. Re-run with --apply.\n");
        return;
    }

    for (let i = 0; i < refs.length; i += BATCH_LIMIT) {
        const batch = db.batch();
        for (const ref of refs.slice(i, i + BATCH_LIMIT)) batch.delete(ref);
        await batch.commit();
        console.log(`  deleted ${Math.min(i + BATCH_LIMIT, refs.length)}/${refs.length}`);
    }
    console.log("\nDeleted. Take a fresh backup before running the backfill.\n");
}

async function main(): Promise<void> {
    const argv = process.argv.slice(2);
    const { db, projectId } = init();
    console.log(
        `\nTarget:  ${process.env.FIRESTORE_EMULATOR_HOST ? "EMULATOR" : "PRODUCTION"}\nProject: ${projectId}\n`,
    );

    const deleteIndex = argv.indexOf("--delete");
    if (deleteIndex >= 0) {
        const file = argv[deleteIndex + 1];
        // Without the flag check, `--delete --apply` takes "--apply" as the
        // path and fails inside readFileSync with an ENOENT rather than usage.
        if (!file || file.startsWith("--")) {
            throw new Error("Usage: --delete <triage-plan.json> [--apply]");
        }
        await runDeletion(db, projectId, file, argv.includes("--apply"));
        return;
    }
    await triage(db, projectId, argv.includes("--aggressive"));
}

main().catch((error: unknown) => {
    console.error(
        `\nTriage failed: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exit(1);
});
