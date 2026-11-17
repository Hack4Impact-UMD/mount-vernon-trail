import type { Response } from "express";

// Raised when the MVT Google account has never completed the admin OAuth flow,
// or its refresh token has been revoked/lost. Surfaces to clients as a 401.
export class NotAuthenticatedError extends Error {
    constructor(message = "Not authenticated. Admin must sign in.") {
        super(message);
        this.name = "NotAuthenticatedError";
    }
}

// Raised by the CORS origin callback. A dedicated type rather than a message
// string, so the error handler can identify it with instanceof instead of a
// substring match that no type checker protects and any upstream error text
// could accidentally satisfy.
export class CorsRejectedError extends Error {
    readonly origin: string;

    constructor(origin: string) {
        super(`Origin ${origin} is not allowed`);
        this.name = "CorsRejectedError";
        this.origin = origin;
    }
}

// Raised when Google Photos itself rejects a request. `status` is Google's
// status code; `body` is its raw response, preserved for debugging.
export class GooglePhotosError extends Error {
    readonly status: number;
    readonly body: string;
    readonly retryAfterMs: number;

    constructor(status: number, body: string, retryAfter?: string | null) {
        super(`Google Photos API error (${status})`);
        this.name = "GooglePhotosError";
        this.status = status;
        this.body = body;
        const seconds = retryAfter ? Number(retryAfter) : NaN;
        const delay = Number.isFinite(seconds)
            ? seconds * 1000
            : retryAfter
              ? Date.parse(retryAfter) - Date.now()
              : 0;
        this.retryAfterMs = Math.max(
            30_000,
            Number.isFinite(delay) ? delay : 0,
        );
    }
}

// Single place every /api route funnels failures through, so the 401/502/500
// mapping stays identical across routes.
export function sendError(
    res: Response,
    context: string,
    error: unknown,
): Response {
    if (error instanceof NotAuthenticatedError) {
        return res.status(401).json({ error: error.message });
    }
    if (error instanceof GooglePhotosError) {
        // Logged in full, but deliberately NOT returned: Google's error body can
        // name the project, the service account and quota state, and every
        // volunteer holding an ID token would receive it. The status is enough
        // for a client to branch on.
        console.error(`${context}:`, error.status, error.body);
        if (error.status === 429) {
            res.setHeader("Retry-After", Math.ceil(error.retryAfterMs / 1000));
            return res.status(429).json({
                error: "Google Photos is busy. Your photos will retry automatically.",
                retryAfterMs: error.retryAfterMs,
            });
        }
        return res.status(error.status === 404 ? 404 : 502).json({
            error: "Google Photos API error",
            status: error.status,
        });
    }
    console.error(`${context}:`, error);
    return res.status(500).json({ error: context });
}

// Only thrown by the byte-transfer phase, before any media item is created.
export class PhotoByteTransferError extends Error {
    constructor() {
        super("Photo transfer was interrupted. It will retry automatically.");
        this.name = "PhotoByteTransferError";
    }
}
