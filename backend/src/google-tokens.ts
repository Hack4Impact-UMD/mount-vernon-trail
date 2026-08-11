import { Redis } from "@upstash/redis";
import { google } from "googleapis";
import type { Env } from "./env";
import { NotAuthenticatedError } from "./errors";
import { createInMemoryStore, type KeyValueStore } from "./kv-store";

const ACCESS_TOKEN_KEY = "access_token";
const REFRESH_TOKEN_KEY = "refresh_token";
const STATE_PREFIX = "oauth_state:";
const STATE_TTL_SECONDS = 600;
const EXPIRY_SKEW_MS = 60_000;

// Taken from googleapis rather than google-auth-library directly: the two
// resolve to different nested copies of the package with incompatible private
// fields, and this is the one google.auth.OAuth2 actually constructs.
export type OAuth2Client = InstanceType<typeof google.auth.OAuth2>;

export const GOOGLE_PHOTOS_SCOPES = [
    "https://www.googleapis.com/auth/photoslibrary.appendonly",
    "https://www.googleapis.com/auth/photoslibrary.readonly.appcreateddata",
];

export type TokenStore = {
    getAccessToken: () => Promise<string>;
    isAuthenticated: () => Promise<boolean>;
    createAuthUrl: () => Promise<string>;
    consumeState: (state: string) => Promise<boolean>;
    exchangeCode: (code: string) => Promise<void>;
};

// Falls back to a process-local store when Upstash is not configured, so the
// server runs locally before anyone has provisioned Redis. env.ts refuses that
// fallback in production, where losing the refresh token on restart — or
// diverging between replicas — would be a real outage.
export function createTokenKeyValueStore(env: Env): KeyValueStore {
    if (!env.upstashRedisUrl || !env.upstashRedisToken) {
        console.warn(
            "Upstash is not configured — using an in-memory token store. " +
                "Tokens are lost on restart and not shared between processes. " +
                "Local development only.",
        );
        return createInMemoryStore();
    }
    return new Redis({
        url: env.upstashRedisUrl,
        token: env.upstashRedisToken,
    });
}

export function createOAuthClient(env: Env): OAuth2Client {
    return new google.auth.OAuth2(
        env.googleClientId,
        env.googleClientSecret,
        env.googleRedirectUri,
    );
}

export function createTokenStore(
    env: Env,
    redis: KeyValueStore,
    oauth2Client: OAuth2Client,
): TokenStore {
    // Per-process cache avoids a Redis round-trip on every request; Redis keeps
    // all replicas on the same token. `inflight` collapses concurrent refreshes.
    let cachedToken: string | null = null;
    let cachedExpiry = 0;
    let inflight: Promise<string> | null = null;

    async function readRefreshToken(): Promise<string | null> {
        const stored = await redis.get<string>(REFRESH_TOKEN_KEY);
        if (stored) return stored;
        // Fallback so a wiped free-tier Redis does not require redoing the
        // whole admin OAuth dance. Re-seeds Redis on first use.
        if (env.googleRefreshToken) {
            await redis.set(REFRESH_TOKEN_KEY, env.googleRefreshToken);
            return env.googleRefreshToken;
        }
        return null;
    }

    async function cacheAccessToken(
        token: string,
        expiryDate: number,
    ): Promise<void> {
        const ttlSeconds = Math.max(
            60,
            Math.floor((expiryDate - Date.now()) / 1000) - 60,
        );
        await redis.set(ACCESS_TOKEN_KEY, token, { ex: ttlSeconds });
        cachedToken = token;
        cachedExpiry = expiryDate;
    }

    async function refresh(): Promise<string> {
        const cached = await redis.get<string>(ACCESS_TOKEN_KEY);
        if (cached) {
            const ttl = await redis.ttl(ACCESS_TOKEN_KEY);
            if (ttl > 60) {
                cachedToken = cached;
                cachedExpiry = Date.now() + ttl * 1000;
                return cached;
            }
        }

        const refreshToken = await readRefreshToken();
        if (!refreshToken) {
            throw new NotAuthenticatedError();
        }

        oauth2Client.setCredentials({ refresh_token: refreshToken });
        const { token } = await oauth2Client.getAccessToken();
        if (!token) {
            throw new NotAuthenticatedError(
                "Failed to refresh the Google access token. Admin must sign in again.",
            );
        }
        const expiryDate =
            oauth2Client.credentials.expiry_date ?? Date.now() + 3600_000;
        await cacheAccessToken(token, expiryDate);
        return token;
    }

    return {
        async getAccessToken(): Promise<string> {
            if (cachedToken && Date.now() < cachedExpiry - EXPIRY_SKEW_MS) {
                return cachedToken;
            }
            if (inflight) return inflight;
            inflight = refresh().finally(() => {
                inflight = null;
            });
            return inflight;
        },

        async isAuthenticated(): Promise<boolean> {
            if (env.googleRefreshToken) return true;
            return (await redis.exists(REFRESH_TOKEN_KEY)) > 0;
        },

        async createAuthUrl(): Promise<string> {
            const { randomBytes } = await import("crypto");
            const state = randomBytes(32).toString("hex");
            // Keyed per attempt, so concurrent admin sign-ins cannot clobber
            // each other's nonce the way a single global key did.
            await redis.set(`${STATE_PREFIX}${state}`, "1", {
                ex: STATE_TTL_SECONDS,
            });
            return oauth2Client.generateAuthUrl({
                access_type: "offline",
                scope: GOOGLE_PHOTOS_SCOPES,
                prompt: "consent",
                state,
            });
        },

        async consumeState(state: string): Promise<boolean> {
            if (!state) return false;
            const deleted = await redis.del(`${STATE_PREFIX}${state}`);
            return deleted > 0;
        },

        async exchangeCode(code: string): Promise<void> {
            const { tokens } = await oauth2Client.getToken(code);
            if (tokens.refresh_token) {
                await redis.set(REFRESH_TOKEN_KEY, tokens.refresh_token);
            }
            if (tokens.access_token) {
                await cacheAccessToken(
                    tokens.access_token,
                    tokens.expiry_date ?? Date.now() + 3600_000,
                );
            }
        },
    };
}
