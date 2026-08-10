import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import type { Env } from "./env";
import { loadServiceAccount } from "./service-account";

let authInstance: Auth | null = null;

export function initFirebase(env: Env): Auth {
    if (authInstance) return authInstance;
    if (getApps().length === 0) {
        const account = loadServiceAccount(
            env.firebaseServiceAccountJson,
            "FIREBASE_SERVICE_ACCOUNT_JSON",
        );
        initializeApp({
            credential: cert({
                projectId: account.project_id,
                clientEmail: account.client_email,
                privateKey: account.private_key,
            }),
        });
    }
    authInstance = getAuth();
    return authInstance;
}
