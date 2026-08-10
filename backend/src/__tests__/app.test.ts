import type { Auth } from "firebase-admin/auth";
import request from "supertest";
import { createApp } from "../app";
import type { Env } from "../env";
import { GooglePhotosError, NotAuthenticatedError } from "../errors";
import * as photos from "../google-photos";
import type { TokenStore } from "../google-tokens";

jest.mock("../google-photos");

const mockPhotos = photos as jest.Mocked<typeof photos>;

const TEST_ENV: Env = {
    port: 8080,
    googleClientId: "client-id",
    googleClientSecret: "client-secret",
    googleRedirectUri: "http://localhost:8080/auth/callback",
    googleRefreshToken: null,
    upstashRedisUrl: "https://redis.example",
    upstashRedisToken: "redis-token",
    firebaseServiceAccountJson: "{}",
    allowedOrigins: ["https://app.example"],
    maxUploadFiles: 3,
    maxUploadBytesPerFile: 1024,
};

type Harness = {
    app: ReturnType<typeof createApp>;
    verifyIdToken: jest.Mock;
    tokenStore: jest.Mocked<TokenStore>;
};

function harness(overrides: Partial<Env> = {}): Harness {
    const verifyIdToken = jest.fn();
    const auth = { verifyIdToken } as unknown as Auth;
    const tokenStore: jest.Mocked<TokenStore> = {
        getAccessToken: jest.fn().mockResolvedValue("google-access-token"),
        isAuthenticated: jest.fn().mockResolvedValue(true),
        createAuthUrl: jest.fn().mockResolvedValue("https://accounts.google.com/o"),
        consumeState: jest.fn().mockResolvedValue(true),
        exchangeCode: jest.fn().mockResolvedValue(undefined),
    };
    return {
        app: createApp({ ...TEST_ENV, ...overrides }, auth, tokenStore),
        verifyIdToken,
        tokenStore,
    };
}

function asVolunteer(h: Harness): void {
    h.verifyIdToken.mockResolvedValue({ uid: "u1", email: "v@example.com" });
}

function asAdmin(h: Harness): void {
    h.verifyIdToken.mockResolvedValue({
        uid: "a1",
        email: "a@example.com",
        admin: true,
    });
}

describe("health", () => {
    it("reports the service without auth", async () => {
        const res = await request(harness().app).get("/");
        expect(res.status).toBe(200);
        expect(res.body).toEqual({
            service: "mount-vernon-trail-backend",
            ok: true,
        });
    });
});

describe("Firebase ID token gate on /api", () => {
    it("rejects a request with no Authorization header", async () => {
        const res = await request(harness().app).get("/api/auth/status");
        expect(res.status).toBe(401);
        expect(res.body.error).toMatch(/missing Authorization/i);
    });

    it("rejects a non-bearer Authorization header", async () => {
        const res = await request(harness().app)
            .get("/api/auth/status")
            .set("Authorization", "Basic abc123");
        expect(res.status).toBe(401);
    });

    it("rejects an invalid or expired ID token", async () => {
        const h = harness();
        h.verifyIdToken.mockRejectedValue(
            Object.assign(new Error("expired"), {
                code: "auth/id-token-expired",
            }),
        );
        const res = await request(h.app)
            .get("/api/auth/status")
            .set("Authorization", "Bearer stale");
        expect(res.status).toBe(401);
        expect(res.body.code).toBe("auth/id-token-expired");
    });

    it("accepts a valid ID token", async () => {
        const h = harness();
        asVolunteer(h);
        const res = await request(h.app)
            .get("/api/auth/status")
            .set("Authorization", "Bearer good");
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ authenticated: true });
        expect(h.verifyIdToken).toHaveBeenCalledWith("good");
    });
});

describe("CORS", () => {
    it("allows an origin on the allowlist", async () => {
        const h = harness();
        const res = await request(h.app)
            .get("/")
            .set("Origin", "https://app.example");
        expect(res.status).toBe(200);
        expect(res.headers["access-control-allow-origin"]).toBe(
            "https://app.example",
        );
    });

    it("rejects an origin that is not on the allowlist", async () => {
        const res = await request(harness().app)
            .get("/")
            .set("Origin", "https://evil.example");
        expect(res.status).toBe(403);
    });

    it("allows a client that sends no Origin at all (React Native)", async () => {
        const res = await request(harness().app).get("/");
        expect(res.status).toBe(200);
    });
});

describe("POST /api/albums", () => {
    it("rejects a missing title", async () => {
        const h = harness();
        asVolunteer(h);
        const res = await request(h.app)
            .post("/api/albums")
            .set("Authorization", "Bearer good")
            .send({});
        expect(res.status).toBe(400);
        expect(mockPhotos.createAlbum).not.toHaveBeenCalled();
    });

    it("rejects a whitespace-only title", async () => {
        const h = harness();
        asVolunteer(h);
        const res = await request(h.app)
            .post("/api/albums")
            .set("Authorization", "Bearer good")
            .send({ title: "   " });
        expect(res.status).toBe(400);
    });

    it("creates an album", async () => {
        const h = harness();
        asVolunteer(h);
        mockPhotos.createAlbum.mockResolvedValue({ id: "alb1", title: "Cleanup" });
        const res = await request(h.app)
            .post("/api/albums")
            .set("Authorization", "Bearer good")
            .send({ title: "  Cleanup  " });
        expect(res.status).toBe(201);
        expect(res.body).toEqual({ id: "alb1", title: "Cleanup" });
        expect(mockPhotos.createAlbum).toHaveBeenCalledWith(
            "google-access-token",
            "Cleanup",
        );
    });

    it("maps a Google Photos failure to 502", async () => {
        const h = harness();
        asVolunteer(h);
        mockPhotos.createAlbum.mockRejectedValue(
            new GooglePhotosError(500, "upstream boom"),
        );
        const res = await request(h.app)
            .post("/api/albums")
            .set("Authorization", "Bearer good")
            .send({ title: "Cleanup" });
        expect(res.status).toBe(502);
        expect(res.body).toMatchObject({ status: 500, body: "upstream boom" });
    });

    it("maps a missing MVT refresh token to 401", async () => {
        const h = harness();
        asVolunteer(h);
        h.tokenStore.getAccessToken.mockRejectedValue(new NotAuthenticatedError());
        const res = await request(h.app)
            .post("/api/albums")
            .set("Authorization", "Bearer good")
            .send({ title: "Cleanup" });
        expect(res.status).toBe(401);
        expect(res.body.error).toMatch(/Admin must sign in/i);
    });
});

describe("GET /api/albums", () => {
    it("forwards the pageToken", async () => {
        const h = harness();
        asVolunteer(h);
        mockPhotos.listAlbums.mockResolvedValue({ albums: [] });
        const res = await request(h.app)
            .get("/api/albums?pageToken=abc")
            .set("Authorization", "Bearer good");
        expect(res.status).toBe(200);
        expect(mockPhotos.listAlbums).toHaveBeenCalledWith(
            "google-access-token",
            "abc",
        );
    });

    it("omits an absent pageToken", async () => {
        const h = harness();
        asVolunteer(h);
        mockPhotos.listAlbums.mockResolvedValue({ albums: [] });
        await request(h.app).get("/api/albums").set("Authorization", "Bearer good");
        expect(mockPhotos.listAlbums).toHaveBeenCalledWith(
            "google-access-token",
            undefined,
        );
    });
});

describe("GET /api/photos/:photoId", () => {
    it("passes a Google 404 through as a 404", async () => {
        const h = harness();
        asVolunteer(h);
        mockPhotos.getMediaItem.mockRejectedValue(
            new GooglePhotosError(404, "not found"),
        );
        const res = await request(h.app)
            .get("/api/photos/missing")
            .set("Authorization", "Bearer good");
        expect(res.status).toBe(404);
    });
});

describe("POST /api/upload", () => {
    it("rejects a request with no files", async () => {
        const h = harness();
        asVolunteer(h);
        const res = await request(h.app)
            .post("/api/upload")
            .set("Authorization", "Bearer good")
            .field("albumId", "alb1");
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/at least one photo/i);
    });

    it("rejects a request with no albumId", async () => {
        const h = harness();
        asVolunteer(h);
        const res = await request(h.app)
            .post("/api/upload")
            .set("Authorization", "Bearer good")
            .attach("photos", Buffer.from("img"), "before.jpg");
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/albumId is required/i);
    });

    it("uploads every photo and attaches them in one batch", async () => {
        const h = harness();
        asVolunteer(h);
        mockPhotos.uploadBytes
            .mockResolvedValueOnce("tok-a")
            .mockResolvedValueOnce("tok-b");
        mockPhotos.batchCreate.mockResolvedValue({ newMediaItemResults: [] });

        const res = await request(h.app)
            .post("/api/upload")
            .set("Authorization", "Bearer good")
            .field("albumId", "alb1")
            .field("descriptions", "before shot")
            .field("descriptions", "after shot")
            .attach("photos", Buffer.from("a"), "before.jpg")
            .attach("photos", Buffer.from("b"), "after.jpg");

        expect(res.status).toBe(201);
        expect(res.body.failed).toEqual([]);
        expect(mockPhotos.batchCreate).toHaveBeenCalledWith(
            "google-access-token",
            "alb1",
            [
                {
                    uploadToken: "tok-a",
                    fileName: "before.jpg",
                    description: "before shot",
                },
                {
                    uploadToken: "tok-b",
                    fileName: "after.jpg",
                    description: "after shot",
                },
            ],
        );
    });

    it("returns 207 and names the casualties when only some uploads fail", async () => {
        const h = harness();
        asVolunteer(h);
        mockPhotos.uploadBytes
            .mockResolvedValueOnce("tok-a")
            .mockRejectedValueOnce(new Error("network reset"));
        mockPhotos.batchCreate.mockResolvedValue({ newMediaItemResults: [] });

        const res = await request(h.app)
            .post("/api/upload")
            .set("Authorization", "Bearer good")
            .field("albumId", "alb1")
            .attach("photos", Buffer.from("a"), "before.jpg")
            .attach("photos", Buffer.from("b"), "after.jpg");

        expect(res.status).toBe(207);
        expect(res.body.failed).toEqual([
            { fileName: "after.jpg", error: "network reset" },
        ]);
        // The surviving photo is still attached rather than discarded.
        expect(mockPhotos.batchCreate).toHaveBeenCalledWith(
            "google-access-token",
            "alb1",
            [
                {
                    uploadToken: "tok-a",
                    fileName: "before.jpg",
                    description: undefined,
                },
            ],
        );
    });

    it("returns 502 and skips batchCreate when every upload fails", async () => {
        const h = harness();
        asVolunteer(h);
        mockPhotos.uploadBytes.mockRejectedValue(new Error("network reset"));

        const res = await request(h.app)
            .post("/api/upload")
            .set("Authorization", "Bearer good")
            .field("albumId", "alb1")
            .attach("photos", Buffer.from("a"), "before.jpg");

        expect(res.status).toBe(502);
        expect(res.body.failed).toHaveLength(1);
        expect(mockPhotos.batchCreate).not.toHaveBeenCalled();
    });

    it("rejects a photo over the per-file size limit", async () => {
        const h = harness({ maxUploadBytesPerFile: 8 });
        asVolunteer(h);
        const res = await request(h.app)
            .post("/api/upload")
            .set("Authorization", "Bearer good")
            .field("albumId", "alb1")
            .attach("photos", Buffer.alloc(64), "big.jpg");
        expect(res.status).toBe(413);
        expect(mockPhotos.uploadBytes).not.toHaveBeenCalled();
    });
});

describe("admin OAuth bootstrap", () => {
    it("refuses a signed-in volunteer without the admin claim", async () => {
        const h = harness();
        asVolunteer(h);
        const res = await request(h.app)
            .get("/auth/url")
            .set("Authorization", "Bearer good");
        expect(res.status).toBe(403);
        expect(h.tokenStore.createAuthUrl).not.toHaveBeenCalled();
    });

    it("refuses an unauthenticated caller", async () => {
        const res = await request(harness().app).get("/auth/url");
        expect(res.status).toBe(401);
    });

    it("returns the consent URL as JSON for an admin", async () => {
        const h = harness();
        asAdmin(h);
        const res = await request(h.app)
            .get("/auth/url")
            .set("Authorization", "Bearer good");
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ url: "https://accounts.google.com/o" });
    });

    it("rejects a callback whose state nonce is unknown or already used", async () => {
        const h = harness();
        h.tokenStore.consumeState.mockResolvedValue(false);
        const res = await request(h.app).get("/auth/callback?code=c&state=stale");
        expect(res.status).toBe(401);
        expect(h.tokenStore.exchangeCode).not.toHaveBeenCalled();
    });

    it("exchanges the code when the state nonce is valid", async () => {
        const h = harness();
        const res = await request(h.app).get("/auth/callback?code=abc&state=fresh");
        expect(res.status).toBe(200);
        expect(h.tokenStore.consumeState).toHaveBeenCalledWith("fresh");
        expect(h.tokenStore.exchangeCode).toHaveBeenCalledWith("abc");
    });
});
