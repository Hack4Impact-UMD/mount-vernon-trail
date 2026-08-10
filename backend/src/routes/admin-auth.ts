import { Router, type Request, type Response } from "express";
import type { Auth } from "firebase-admin/auth";
import type { TokenStore } from "../google-tokens";
import { requireAdmin, requireFirebaseAuth } from "../middleware/auth";

// Admin-only bootstrap for the MVT Google account. Returns the consent URL as
// JSON rather than a 302: the previous version demanded an x-api-key *header*
// and then redirected, which a browser address bar can never satisfy.
export function createAdminAuthRouter(
    auth: Auth,
    tokenStore: TokenStore,
): Router {
    const router = Router();

    router.get(
        "/auth/url",
        requireFirebaseAuth(auth),
        requireAdmin,
        async (_req: Request, res: Response) => {
            try {
                return res.status(200).json({ url: await tokenStore.createAuthUrl() });
            } catch (error) {
                console.error("Failed to build Google auth URL:", error);
                return res
                    .status(500)
                    .json({ error: "Failed to build Google auth URL" });
            }
        },
    );

    // Hit by Google's redirect, so it cannot carry an Authorization header.
    // The single-use state nonce is what authenticates it.
    router.get("/auth/callback", async (req: Request, res: Response) => {
        const state = typeof req.query.state === "string" ? req.query.state : "";
        const code = typeof req.query.code === "string" ? req.query.code : "";

        if (!(await tokenStore.consumeState(state))) {
            return res
                .status(401)
                .send("Authentication failed: invalid or expired state.");
        }
        if (!code) {
            return res.status(400).send("Authentication failed: missing code.");
        }

        try {
            await tokenStore.exchangeCode(code);
            return res
                .status(200)
                .send("Authentication successful! You can close this window.");
        } catch (error) {
            console.error("Error exchanging code for token:", error);
            return res.status(401).send("Authentication failed.");
        }
    });

    return router;
}
