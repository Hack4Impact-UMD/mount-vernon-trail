// Mints a Firebase ID token for an existing user, for calling this API from
// curl during local development — chiefly the admin-only GET /auth/url, which
// the app has no screen for. Getting a token off a physical iOS device means
// patching in a console.log and fishing it out of Metro; this skips the device.
//
//   npm run -s mint-token -- someone@example.com
//   curl -H "Authorization: Bearer $(npm run -s mint-token -- you@example.com)" \
//        http://localhost:8080/auth/url
//
// The token goes to stdout alone so it can be captured with $(...); everything
// else goes to stderr. It lasts one hour.
//
// This can impersonate ANY user in the project — it only needs the service
// account. Keep it a local tool: never expose it through the server.

import "dotenv/config";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "dotenv";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { loadServiceAccount } from "../src/service-account";

const FRONTEND_ENV = resolve(__dirname, "../../frontend/.env");

// Deliberately not loadEnv(), for the same reason as set-admin-claim.ts: this
// needs only the service account, not the Google/Upstash server variables.
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

// Exchanging a custom token needs the project's web API key, which the backend
// otherwise never uses. Borrow the app's rather than adding a server variable.
function webApiKey(): string {
    const override = process.env.FIREBASE_WEB_API_KEY?.trim();
    if (override) return override;
    try {
        const key = parse(
            readFileSync(FRONTEND_ENV),
        ).EXPO_PUBLIC_FIREBASE_API_KEY?.trim();
        if (key) return key;
    } catch (error: unknown) {
        const code =
            error instanceof Error && "code" in error ? String(error.code) : "";
        if (code !== "ENOENT") throw error;
    }
    throw new Error(
        `No Firebase web API key: set EXPO_PUBLIC_FIREBASE_API_KEY in ${FRONTEND_ENV}, ` +
            "or FIREBASE_WEB_API_KEY in the environment.",
    );
}

type SignInResponse = { idToken?: string; error?: { message?: string } };

async function exchangeCustomToken(
    customToken: string,
    apiKey: string,
): Promise<string> {
    const res = await fetch(
        "https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken" +
            `?key=${encodeURIComponent(apiKey)}`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                token: customToken,
                returnSecureToken: true,
            }),
        },
    );
    const body = (await res.json()) as SignInResponse;
    if (res.ok && body.idToken) return body.idToken;

    const message = body.error?.message ?? `HTTP ${res.status}`;
    // An API key restricted to the iOS bundle rejects calls from anywhere else.
    const hint = /blocked|referer|ios client/i.test(message)
        ? "\nThe web API key has application restrictions. Use an unrestricted key " +
          "via FIREBASE_WEB_API_KEY."
        : "";
    throw new Error(`signInWithCustomToken failed: ${message}${hint}`);
}

async function main(): Promise<void> {
    const email = process.argv.slice(2).find((a) => !a.startsWith("--"));
    if (!email) {
        console.error("Usage: npm run -s mint-token -- <email>");
        process.exit(1);
    }

    initAdmin();
    const apiKey = webApiKey();
    const user = await getAuth().getUserByEmail(email);
    // No developer claims passed: the ID token then carries exactly the claims
    // stored on the user, so it is refused by requireAdmin exactly when the
    // real app's token would be.
    const idToken = await exchangeCustomToken(
        await getAuth().createCustomToken(user.uid),
        apiKey,
    );

    const admin =
        (user.customClaims as Record<string, unknown> | undefined)?.admin ===
        true;
    console.error(
        `ID token for ${email} (uid ${user.uid}, admin: ${admin}), valid for 1 hour.` +
            (admin
                ? ""
                : "\nNo admin claim — /auth/url will return 403. Run npm run set-admin first."),
    );
    console.log(idToken);
}

main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});
