// Grants or revokes the `admin` custom claim that gates admin-only routes here
// and admin-only writes in firestore.rules.
//
//   npm run set-admin -- someone@example.com
//   npm run set-admin -- someone@example.com --revoke
//   npm run set-admin -- --list
//
// The user must sign out and back in once for the new claim to appear in their
// ID token (cached tokens refresh hourly).

import "dotenv/config";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { loadServiceAccount } from "../src/service-account";

// Deliberately not loadEnv(): this script needs only the service account, and
// requiring the Google/Upstash server variables would make it unusable on a
// machine that is not running the API.
function initAdmin(): void {
    if (getApps().length > 0) return;
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!raw) {
        throw new Error(
            "Set FIREBASE_SERVICE_ACCOUNT_JSON in backend/.env — either a path to " +
                "the service-account key file, or the key contents inlined.",
        );
    }
    const account = loadServiceAccount(raw, "FIREBASE_SERVICE_ACCOUNT_JSON");
    initializeApp({
        credential: cert({
            projectId: account.project_id,
            clientEmail: account.client_email,
            privateKey: account.private_key,
        }),
    });
}

async function listAdmins(): Promise<void> {
    const { users } = await getAuth().listUsers(1000);
    const admins = users.filter(
        (u) => (u.customClaims as Record<string, unknown> | undefined)?.admin === true,
    );
    console.log(`${admins.length} admin(s) of ${users.length} user(s):`);
    for (const u of admins) console.log(`  ${u.email ?? u.uid}`);
}

async function main(): Promise<void> {
    const args = process.argv.slice(2);
    initAdmin();

    if (args.includes("--list")) {
        await listAdmins();
        return;
    }

    const email = args.find((a) => !a.startsWith("--"));
    if (!email) {
        console.error("Usage: npm run set-admin -- <email> [--revoke] | --list");
        process.exit(1);
    }
    const admin = !args.includes("--revoke");

    const user = await getAuth().getUserByEmail(email);
    const existing = (user.customClaims ?? {}) as Record<string, unknown>;
    // Merge, so this never silently drops a claim something else set.
    await getAuth().setCustomUserClaims(user.uid, { ...existing, admin });

    console.log(
        `${admin ? "Granted" : "Revoked"} admin for ${email} (uid ${user.uid}).\n` +
            `They must sign out and back in for it to take effect.`,
    );
}

main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});
