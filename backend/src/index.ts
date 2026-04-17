import { Redis } from "@upstash/redis";
import cors from "cors";
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

// in-memory cache for access token
// will become null if server spins down
let accessToken: string | null = null;
let tokenExpiryTime: number = 0;

app.get("/", (req: Request, res: Response) => {
    res.send("Hello World!");
});

// Ensure that this matched the GOOGLE_REDIRECT_URI
app.get("/auth/url", (req: Request, res: Response) => {
    const secret = req.query.secret as string;
    if (secret !== process.env.ADMIN_SECRET_KEY) {
        return res
            .status(401)
            .json({ error: "Unauthorized: Invalid auth secret" });
    }
    const authUrl = oauth2Client.generateAuthUrl({
        access_type: "offline",
        scope: scopes,
        prompt: "consent",
        state: secret,
    });
    res.redirect(authUrl);
});

app.get("/auth/callback", async (req: Request, res: Response) => {
    const state = req.query.state as string;
    if (state !== process.env.ADMIN_SECRET_KEY) {
        return res
            .status(401)
            .json({ error: "Unauthorized: Invalid callback state" });
    }
    // get authorization code
    const code = req.query.code as string;
    try {
        // exchange code for tokens (access + possibly refresh)
        const { tokens } = await oauth2Client.getToken(code);
        // check if we got a refresh token, and if so, store in Redis
        if (tokens.refresh_token) {
            await redis.set("refresh_token", tokens.refresh_token);
        }
        // check if we got a access otken, and if so, store in memory
        if (tokens.access_token) {
            const expiresIn = 3600;
            accessToken = tokens.access_token;
            tokenExpiryTime = Date.now() + expiresIn * 1000;
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

// TODO: google photos upload endpoint
app.post(
    "/api/upload",
    upload.single("photo"),
    async (req: Request, res: Response) => {
        // code here
    },
);

// TODO: google photos create album endpoint
app.post("/api/albums", async (req: Request, res: Response) => {
    // code here
});

// TODO: google photos list albums endpoint
app.get("/api/albums", async (req: Request, res: Response) => {
    // code here
});

// TODO: get images in album endpoint
app.get("/api/albums/:albumId/photos", async (req: Request, res: Response) => {
    // code here
});

// TODO: get photo by ID
app.get("/api/photos/:photoId", async (req: Request, res: Response) => {
    // code here
});

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
});
