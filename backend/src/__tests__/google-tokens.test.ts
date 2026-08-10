import type { Redis } from "@upstash/redis";
import type { Env } from "../env";
import { NotAuthenticatedError } from "../errors";
import { createTokenStore, type OAuth2Client } from "../google-tokens";

const BASE_ENV: Env = {
    port: 8080,
    googleClientId: "client-id",
    googleClientSecret: "client-secret",
    googleRedirectUri: "http://localhost:8080/auth/callback",
    googleRefreshToken: null,
    upstashRedisUrl: "https://redis.example",
    upstashRedisToken: "redis-token",
    firebaseServiceAccountJson: "{}",
    allowedOrigins: [],
    maxUploadFiles: 10,
    maxUploadBytesPerFile: 1024,
};

type FakeRedis = {
    get: jest.Mock;
    set: jest.Mock;
    ttl: jest.Mock;
    del: jest.Mock;
    exists: jest.Mock;
};

function fakeRedis(): FakeRedis {
    return {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue("OK"),
        ttl: jest.fn().mockResolvedValue(-2),
        del: jest.fn().mockResolvedValue(1),
        exists: jest.fn().mockResolvedValue(0),
    };
}

function fakeOAuth(token: string | null = "fresh-token"): {
    client: OAuth2Client;
    getAccessToken: jest.Mock;
} {
    const getAccessToken = jest.fn().mockResolvedValue({ token });
    const client = {
        setCredentials: jest.fn(),
        getAccessToken,
        generateAuthUrl: jest.fn().mockReturnValue("https://consent.example"),
        getToken: jest.fn().mockResolvedValue({
            tokens: { refresh_token: "new-refresh", access_token: "new-access" },
        }),
        credentials: { expiry_date: Date.now() + 3600_000 },
    } as unknown as OAuth2Client;
    return { client, getAccessToken };
}

function build(env: Partial<Env> = {}, redis = fakeRedis(), oauth = fakeOAuth()) {
    return {
        store: createTokenStore({ ...BASE_ENV, ...env }, redis as unknown as Redis, oauth.client),
        redis,
        oauth,
    };
}

describe("getAccessToken", () => {
    it("refreshes when Redis holds no cached access token", async () => {
        const redis = fakeRedis();
        redis.get.mockImplementation(async (key: string) =>
            key === "refresh_token" ? "stored-refresh" : null,
        );
        const { store, oauth } = build({}, redis);

        await expect(store.getAccessToken()).resolves.toBe("fresh-token");
        expect(oauth.client.setCredentials).toHaveBeenCalledWith({
            refresh_token: "stored-refresh",
        });
        expect(redis.set).toHaveBeenCalledWith(
            "access_token",
            "fresh-token",
            expect.objectContaining({ ex: expect.any(Number) }),
        );
    });

    it("uses the Redis-cached access token when its TTL is comfortable", async () => {
        const redis = fakeRedis();
        redis.get.mockImplementation(async (key: string) =>
            key === "access_token" ? "cached-token" : null,
        );
        redis.ttl.mockResolvedValue(3000);
        const { store, oauth } = build({}, redis);

        await expect(store.getAccessToken()).resolves.toBe("cached-token");
        expect(oauth.getAccessToken).not.toHaveBeenCalled();
    });

    it("ignores a Redis-cached token that is about to expire", async () => {
        const redis = fakeRedis();
        redis.get.mockImplementation(async (key: string) =>
            key === "access_token" ? "stale-token" : "stored-refresh",
        );
        redis.ttl.mockResolvedValue(30);
        const { store } = build({}, redis);

        await expect(store.getAccessToken()).resolves.toBe("fresh-token");
    });

    it("serves the in-memory token without touching Redis on the second call", async () => {
        const redis = fakeRedis();
        redis.get.mockImplementation(async (key: string) =>
            key === "refresh_token" ? "stored-refresh" : null,
        );
        const { store } = build({}, redis);

        await store.getAccessToken();
        redis.get.mockClear();
        await expect(store.getAccessToken()).resolves.toBe("fresh-token");
        expect(redis.get).not.toHaveBeenCalled();
    });

    it("collapses concurrent callers into a single refresh", async () => {
        const redis = fakeRedis();
        redis.get.mockImplementation(async (key: string) =>
            key === "refresh_token" ? "stored-refresh" : null,
        );
        const { store, oauth } = build({}, redis);

        const results = await Promise.all([
            store.getAccessToken(),
            store.getAccessToken(),
            store.getAccessToken(),
        ]);

        expect(results).toEqual(["fresh-token", "fresh-token", "fresh-token"]);
        expect(oauth.getAccessToken).toHaveBeenCalledTimes(1);
    });

    it("falls back to GOOGLE_REFRESH_TOKEN when Redis has been wiped", async () => {
        const redis = fakeRedis();
        const { store } = build({ googleRefreshToken: "env-refresh" }, redis);

        await expect(store.getAccessToken()).resolves.toBe("fresh-token");
        // Re-seeds Redis so later calls need no env fallback.
        expect(redis.set).toHaveBeenCalledWith("refresh_token", "env-refresh");
    });

    it("throws NotAuthenticatedError when no refresh token exists anywhere", async () => {
        const { store } = build();
        await expect(store.getAccessToken()).rejects.toBeInstanceOf(
            NotAuthenticatedError,
        );
    });

    it("does not cache a failure — a later call can still succeed", async () => {
        const redis = fakeRedis();
        const { store } = build({}, redis);
        await expect(store.getAccessToken()).rejects.toBeInstanceOf(
            NotAuthenticatedError,
        );

        redis.get.mockImplementation(async (key: string) =>
            key === "refresh_token" ? "stored-refresh" : null,
        );
        await expect(store.getAccessToken()).resolves.toBe("fresh-token");
    });
});

describe("OAuth state nonces", () => {
    it("stores each nonce under its own key so concurrent sign-ins cannot clobber", async () => {
        const redis = fakeRedis();
        const { store } = build({}, redis);

        await store.createAuthUrl();
        await store.createAuthUrl();

        const keys = redis.set.mock.calls.map((call) => call[0] as string);
        expect(keys).toHaveLength(2);
        expect(keys[0]).toMatch(/^oauth_state:[0-9a-f]{64}$/);
        expect(keys[0]).not.toBe(keys[1]);
    });

    it("consumes a nonce exactly once", async () => {
        const redis = fakeRedis();
        redis.del.mockResolvedValueOnce(1).mockResolvedValueOnce(0);
        const { store } = build({}, redis);

        await expect(store.consumeState("abc")).resolves.toBe(true);
        await expect(store.consumeState("abc")).resolves.toBe(false);
        expect(redis.del).toHaveBeenCalledWith("oauth_state:abc");
    });

    it("rejects an empty state without hitting Redis", async () => {
        const redis = fakeRedis();
        const { store } = build({}, redis);
        await expect(store.consumeState("")).resolves.toBe(false);
        expect(redis.del).not.toHaveBeenCalled();
    });
});

describe("isAuthenticated", () => {
    it("is true when Redis holds a refresh token", async () => {
        const redis = fakeRedis();
        redis.exists.mockResolvedValue(1);
        const { store } = build({}, redis);
        await expect(store.isAuthenticated()).resolves.toBe(true);
    });

    it("is false when nothing is stored", async () => {
        const { store } = build();
        await expect(store.isAuthenticated()).resolves.toBe(false);
    });
});
