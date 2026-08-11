import dotenv from "dotenv";
import { loadServiceAccount } from "./service-account";

dotenv.config();

export type Env = {
    port: number;
    googleClientId: string;
    googleClientSecret: string;
    googleRedirectUri: string;
    googleRefreshToken: string | null;
    upstashRedisUrl: string;
    upstashRedisToken: string;
    firebaseServiceAccountJson: string;
    allowedOrigins: string[];
    maxUploadFiles: number;
    maxUploadBytesPerFile: number;
};

const REQUIRED = [
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "GOOGLE_REDIRECT_URI",
    "FIREBASE_SERVICE_ACCOUNT_JSON",
] as const;

function readInt(name: string, fallback: number): number {
    const raw = process.env[name];
    if (!raw) return fallback;
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error(`${name} must be a positive integer, got "${raw}"`);
    }
    return parsed;
}

export function loadEnv(): Env {
    const missing = REQUIRED.filter((name) => !process.env[name]?.trim());
    if (missing.length > 0) {
        throw new Error(
            `Missing required environment variable(s): ${missing.join(", ")}. ` +
                `See backend/.env.example.`,
        );
    }

    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON as string;
    // Validated here so a bad key fails at boot with a clear message rather
    // than on the first authenticated request.
    loadServiceAccount(serviceAccount, "FIREBASE_SERVICE_ACCOUNT_JSON");

    const upstashRedisUrl = process.env.UPSTASH_REDIS_REST_URL?.trim() ?? "";
    const upstashRedisToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim() ?? "";

    // Redis is optional locally (the token store falls back to memory) but
    // mandatory in production: without it the MVT refresh token is lost on every
    // restart and diverges between replicas, so uploads would 401 unpredictably.
    if (
        process.env.NODE_ENV === "production" &&
        (!upstashRedisUrl || !upstashRedisToken)
    ) {
        throw new Error(
            "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required when " +
                "NODE_ENV=production. The in-memory token store is local-development " +
                "only — it loses the Google refresh token on restart.",
        );
    }

    return {
        port: readInt("PORT", 8080),
        googleClientId: process.env.GOOGLE_CLIENT_ID as string,
        googleClientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
        googleRedirectUri: process.env.GOOGLE_REDIRECT_URI as string,
        googleRefreshToken: process.env.GOOGLE_REFRESH_TOKEN?.trim() || null,
        upstashRedisUrl,
        upstashRedisToken,
        firebaseServiceAccountJson: serviceAccount,
        allowedOrigins: (process.env.ALLOWED_ORIGINS ?? "")
            .split(",")
            .map((origin) => origin.trim())
            .filter(Boolean),
        maxUploadFiles: readInt("MAX_UPLOAD_FILES", 10),
        maxUploadBytesPerFile: readInt(
            "MAX_UPLOAD_BYTES_PER_FILE",
            10 * 1024 * 1024,
        ),
    };
}
