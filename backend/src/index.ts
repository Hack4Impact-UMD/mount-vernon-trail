import { Redis } from "@upstash/redis";
import cors from "cors";
import dotenv from "dotenv";
import express, { Request, Response } from "express";
import { google } from "googleapis";
import multer from "multer";

dotenv.config();

const app = express();
const port = process.env.PORT || 8080;

// middleware
app.use(cors());

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
    const authUrl = oauth2Client.generateAuthUrl({
        access_type: "offline",
        scope: scopes,
        prompt: "consent",
    });
    res.redirect(authUrl);
});

app.get("/auth/callback", async (req: Request, res: Response) => {
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
        res.status(200).send(
            "Authentication successful! You can close this window.",
        );
    } catch (error) {
        console.error("Error exchanging code for token:", error);
        res.status(401).send("Authentication failed");
        return;
    }
});

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
});
