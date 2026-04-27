import { Redis } from "@upstash/redis";
import cors from "cors";
import crypto from "crypto";
import dotenv from "dotenv";
import express, { NextFunction, Request, Response } from "express";
import { google } from "googleapis";
import multer from "multer";

dotenv.config();

const app = express();
const port = process.env.PORT || 8080;

// middleware
app.use(cors());
app.use(express.json());

// auth middleware
const requireApiKey = (req: Request, res: Response, next: NextFunction) => {
    const apiKey = req.headers["x-api-key"];
    if (!apiKey || apiKey !== process.env.APP_SECRET_KEY) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    next();
};

// for file uploads, 20 MB limit
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024 },
});

// initialize Redis client
const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// initialize google auth client
const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
);
const scopes = [
    "https://www.googleapis.com/auth/photoslibrary.appendonly",
    "https://www.googleapis.com/auth/photoslibrary.readonly.appcreateddata",
];

// Per-process cache — fast path to avoid a Redis round-trip on every request.
// Falls back to Redis so all replicas share the same token.
let accessToken: string | null = null;
let tokenExpiryTime: number = 0;
// Single-flight: if a refresh is already in progress, callers await the same promise.
let inflightRefresh: Promise<string> | null = null;

// Returns a valid access token. Checks in-memory → Redis → OAuth refresh, in that order.
// Concurrent callers during a refresh share one in-flight Promise to avoid duplicate calls.
async function getAccessToken(): Promise<string> {
    // 1. In-memory fast path (avoids Redis round-trip on every request)
    if (accessToken && Date.now() < tokenExpiryTime - 60_000) {
        return accessToken;
    }
    // 2. Deduplicate concurrent refreshes with a single-flight promise
    if (inflightRefresh) {
        return inflightRefresh;
    }
    inflightRefresh = (async () => {
        try {
            // 3. Redis cache — shared across all replicas
            const cached = await redis.get<string>("access_token");
            if (cached) {
                const ttl = await redis.ttl("access_token");
                if (ttl > 60) {
                    accessToken = cached;
                    tokenExpiryTime = Date.now() + ttl * 1000;
                    return cached;
                }
            }
            // 4. Token missing or nearly expired — perform OAuth refresh
            const refreshToken = await redis.get<string>("refresh_token");
            if (!refreshToken) {
                throw new Error("No refresh token, need to sign in");
            }
            oauth2Client.setCredentials({ refresh_token: refreshToken });
            const { token } = await oauth2Client.getAccessToken();
            if (!token) {
                throw new Error("Failed to refresh access token");
            }
            const expiryDate =
                oauth2Client.credentials.expiry_date ?? Date.now() + 3600_000;
            // Store in Redis with a TTL 60s shorter than actual expiry
            const ttlSeconds = Math.max(
                60,
                Math.floor((expiryDate - Date.now()) / 1000) - 60,
            );
            await redis.set("access_token", token, { ex: ttlSeconds });
            accessToken = token;
            tokenExpiryTime = expiryDate;
            return token;
        } finally {
            inflightRefresh = null;
        }
    })();
    return inflightRefresh;
}

app.get("/", (req: Request, res: Response) => {
    res.send("Hello World!");
});

// Ensure that this matches the GOOGLE_REDIRECT_URI.
// Gated by x-api-key: ADMIN_SECRET_KEY (header, not query param).
// Generates a one-time random CSRF nonce stored in Redis for callback validation.
app.get("/auth/url", async (req: Request, res: Response) => {
    const apiKey = req.headers["x-api-key"];
    if (!apiKey || apiKey !== process.env.ADMIN_SECRET_KEY) {
        return res
            .status(401)
            .json({ error: "Unauthorized: Invalid auth secret" });
    }
    const state = crypto.randomBytes(32).toString("hex");
    // Store nonce in Redis with a 10-minute TTL — single use
    await redis.set("oauth_state", state, { ex: 600 });
    const authUrl = oauth2Client.generateAuthUrl({
        access_type: "offline",
        scope: scopes,
        prompt: "consent",
        state,
    });
    res.redirect(authUrl);
});

app.get("/auth/callback", async (req: Request, res: Response) => {
    const state = req.query.state as string;
    const storedState = await redis.get<string>("oauth_state");
    if (!state || !storedState || state !== storedState) {
        return res
            .status(401)
            .json({ error: "Unauthorized: Invalid or expired state" });
    }
    // Consume the nonce immediately — one-time use only
    await redis.del("oauth_state");
    // get authorization code
    const code = req.query.code as string;
    try {
        // exchange code for tokens (access + possibly refresh)
        const { tokens } = await oauth2Client.getToken(code);
        // check if we got a refresh token, and if so, store in Redis
        if (tokens.refresh_token) {
            await redis.set("refresh_token", tokens.refresh_token);
        }
        // cache the new access token in Redis and in memory
        if (tokens.access_token) {
            const expiryDate = tokens.expiry_date ?? Date.now() + 3600_000;
            const ttlSeconds = Math.max(
                60,
                Math.floor((expiryDate - Date.now()) / 1000) - 60,
            );
            await redis.set("access_token", tokens.access_token, {
                ex: ttlSeconds,
            });
            accessToken = tokens.access_token;
            tokenExpiryTime = expiryDate;
        }
        return res
            .status(200)
            .send("Authentication successful! You can close this window.");
    } catch (error) {
        console.error("Error exchanging code for token:", error);
        return res.status(401).send("Authentication failed");
    }
});

app.use("/api", requireApiKey);

app.get("/api/auth/status", async (req: Request, res: Response) => {
    try {
        const hasRefreshToken = await redis.exists("refresh_token");
        return res.status(200).json({ authenticated: !!hasRefreshToken });
    } catch (error) {
        console.error("Error checking auth status:", error);
        return res
            .status(500)
            .json({ error: "Could not check authentication status" });
    }
});

// Uploads up to 50 photos to a specific album in one call
// Expects:
//   - "photos": one or more image files
//   - "albumId": the target album's id (string)
app.post(
    "/api/upload",
    // Max upload size is 50 photos
    upload.array("photos", 50),
    async (req: Request, res: Response) => {
        try {
            const files = req.files as Express.Multer.File[] | undefined;
            if (!files || files.length === 0) {
                return res
                    .status(400)
                    .json({ error: "at least one photo is required" });
            }
            const { albumId } = req.body;
            if (typeof albumId !== "string" || albumId.trim() === "") {
                return res.status(400).json({ error: "albumId is required" });
            }

            const token = await getAccessToken();

            // Upload each photo's bytes and collect upload tokens in an array
            const uploadTokens: string[] = [];
            for (const file of files) {
                const uploadResponse = await fetch(
                    "https://photoslibrary.googleapis.com/v1/uploads",
                    {
                        method: "POST",
                        headers: {
                            Authorization: `Bearer ${token}`,
                            "Content-Type": "application/octet-stream",
                            "X-Goog-Upload-Content-Type": file.mimetype,
                            "X-Goog-Upload-Protocol": "raw",
                        },
                        body: new Uint8Array(file.buffer),
                    },
                );
                if (!uploadResponse.ok) {
                    const body = await uploadResponse.text();
                    console.error(
                        "Google Photos upload error:",
                        uploadResponse.status,
                        body,
                    );
                    return res.status(502).json({
                        error: "Google Photos upload failed",
                        status: uploadResponse.status,
                        body,
                    });
                }
                uploadTokens.push(await uploadResponse.text());
            }

            // Attach all upload tokens to the album in one batchCreate call
            const batchResponse = await fetch(
                "https://photoslibrary.googleapis.com/v1/mediaItems:batchCreate",
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        albumId,
                        newMediaItems: uploadTokens.map((uploadToken, idx) => ({
                            simpleMediaItem: {
                                fileName: files[idx].originalname,
                                uploadToken,
                            },
                        })),
                    }),
                },
            );
            if (!batchResponse.ok) {
                const body = await batchResponse.text();
                console.error(
                    "Google Photos batchCreate error:",
                    batchResponse.status,
                    body,
                );
                return res.status(502).json({
                    error: "Google Photos batchCreate failed",
                    status: batchResponse.status,
                    body,
                });
            }
            const data = await batchResponse.json();
            return res.status(201).json(data);
        } catch (error) {
            if (
                error instanceof Error &&
                error.message.includes("No refresh token")
            ) {
                return res.status(401).json({
                    error: "Not authenticated. Admin must sign in.",
                });
            }
            console.error("Error uploading photos:", error);
            return res.status(500).json({ error: "Failed to upload photos" });
        }
    },
);

// Creates a new Google Photos album, expects body: { "title": "Album name" }
app.post("/api/albums", async (req: Request, res: Response) => {
    try {
        const { title } = req.body;
        // Validate input
        if (typeof title !== "string" || title.trim() === "") {
            return res.status(400).json({ error: "title is required" });
        }
        const token = await getAccessToken();
        const response = await fetch(
            "https://photoslibrary.googleapis.com/v1/albums",
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ album: { title } }),
            },
        );
        // Check for Google request error
        if (!response.ok) {
            const body = await response.text();
            console.error("Google Photos API error:", response.status, body);
            return res.status(502).json({
                error: "Google Photos API error",
                status: response.status,
                body,
            });
        }
        const data = await response.json();
        return res.status(201).json(data);
    } catch (error) {
        if (
            error instanceof Error &&
            error.message.includes("No refresh token")
        ) {
            return res.status(401).json({
                error: "Not authenticated. Admin must sign in.",
            });
        }
        console.error("Error creating album:", error);
        return res.status(500).json({ error: "Failed to create album" });
    }
});

// Lists albums created by this app
app.get("/api/albums", async (req: Request, res: Response) => {
    try {
        const token = await getAccessToken();
        const pageToken = req.query.pageToken as string | undefined;
        let url = "https://photoslibrary.googleapis.com/v1/albums?pageSize=50";
        if (pageToken) url += `&pageToken=${encodeURIComponent(pageToken)}`;
        const response = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) {
            const body = await response.text();
            console.error("Google Photos API error:", response.status, body);
            return res.status(502).json({
                error: "Google Photos API error",
                status: response.status,
                body,
            });
        }
        const data = await response.json();
        return res.status(200).json(data);
    } catch (error) {
        if (
            error instanceof Error &&
            error.message.includes("No refresh token")
        ) {
            return res.status(401).json({
                error: "Not authenticated. Admin must sign in.",
            });
        }
        console.error("Error listing albums:", error);
        return res.status(500).json({ error: "Failed to list albums" });
    }
});

// Lists media items in an album
app.get("/api/albums/:albumId/photos", async (req: Request, res: Response) => {
    try {
        const albumId = req.params.albumId as string;
        const pageToken = req.query.pageToken as string | undefined;
        const token = await getAccessToken();
        const body: Record<string, unknown> = { albumId, pageSize: 100 };
        if (pageToken) body.pageToken = pageToken;
        const response = await fetch(
            "https://photoslibrary.googleapis.com/v1/mediaItems:search",
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(body),
            },
        );
        if (!response.ok) {
            const text = await response.text();
            console.error("Google Photos API error:", response.status, text);
            return res.status(502).json({
                error: "Google Photos API error",
                status: response.status,
                body: text,
            });
        }
        const data = await response.json();
        return res.status(200).json(data);
    } catch (error) {
        if (
            error instanceof Error &&
            error.message.includes("No refresh token")
        ) {
            return res.status(401).json({
                error: "Not authenticated. Admin must sign in.",
            });
        }
        console.error("Error listing photos:", error);
        return res.status(500).json({ error: "Failed to list photos" });
    }
});

// Gets a single media item by ID
app.get("/api/photos/:photoId", async (req: Request, res: Response) => {
    try {
        const photoId = req.params.photoId as string;
        const token = await getAccessToken();
        const response = await fetch(
            `https://photoslibrary.googleapis.com/v1/mediaItems/${encodeURIComponent(photoId)}`,
            { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!response.ok) {
            const text = await response.text();
            console.error("Google Photos API error:", response.status, text);
            return res.status(response.status === 404 ? 404 : 502).json({
                error: "Google Photos API error",
                status: response.status,
                body: text,
            });
        }
        const data = await response.json();
        return res.status(200).json(data);
    } catch (error) {
        if (
            error instanceof Error &&
            error.message.includes("No refresh token")
        ) {
            return res.status(401).json({
                error: "Not authenticated. Admin must sign in.",
            });
        }
        console.error("Error fetching photo:", error);
        return res.status(500).json({ error: "Failed to fetch photo" });
    }
});

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
});
