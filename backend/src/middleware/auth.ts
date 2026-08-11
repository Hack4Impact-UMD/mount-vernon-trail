import type { Auth } from "firebase-admin/auth";
import type { NextFunction, Request, RequestHandler, Response } from "express";

export type AuthenticatedUser = {
    uid: string;
    email: string | null;
    admin: boolean;
};

declare module "express-serve-static-core" {
    interface Request {
        user?: AuthenticatedUser;
    }
}

function readBearerToken(req: Request): string | null {
    const header = req.headers.authorization;
    if (!header) return null;
    const [scheme, token] = header.split(" ");
    if (scheme?.toLowerCase() !== "bearer" || !token) return null;
    return token.trim() || null;
}

// Verifies the caller's Firebase ID token. Replaces the previous shared
// APP_SECRET_KEY, which an Expo client could only ship inlined in its JS bundle.
export function requireFirebaseAuth(auth: Auth): RequestHandler {
    return async (req: Request, res: Response, next: NextFunction) => {
        const token = readBearerToken(req);
        if (!token) {
            return res.status(401).json({
                error: "Unauthorized: missing Authorization: Bearer <Firebase ID token>",
            });
        }
        try {
            const decoded = await auth.verifyIdToken(token);
            req.user = {
                uid: decoded.uid,
                email: decoded.email ?? null,
                admin: decoded.admin === true,
            };
            next();
        } catch (error) {
            const code =
                error instanceof Error && "code" in error
                    ? String((error as { code: unknown }).code)
                    : "unknown";
            return res.status(401).json({
                error: "Unauthorized: invalid or expired ID token",
                code,
            });
        }
    };
}

// Gates the admin-only Google OAuth bootstrap. Requires the `admin` custom
// claim, matching the frontend's useIsAdmin() and firestore.rules.
export function requireAdmin(
    req: Request,
    res: Response,
    next: NextFunction,
): Response | void {
    if (!req.user?.admin) {
        return res.status(403).json({ error: "Forbidden: admin only" });
    }
    next();
}
