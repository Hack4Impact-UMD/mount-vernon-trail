import cors, { type CorsOptions } from "cors";
import express, {
    type Express,
    type NextFunction,
    type Request,
    type Response,
} from "express";
import type { Auth } from "firebase-admin/auth";
import { MulterError } from "multer";
import type { Env } from "./env";
import type { TokenStore } from "./google-tokens";
import { requireFirebaseAuth } from "./middleware/auth";
import { createAdminAuthRouter } from "./routes/admin-auth";
import { createApiRouter } from "./routes/api";

function corsOptions(env: Env): CorsOptions {
    return {
        origin(origin, callback) {
            // Native clients (React Native, curl) send no Origin header. The
            // browser same-origin policy is what this list protects, so a
            // missing Origin is not something CORS can or should gate.
            if (!origin) return callback(null, true);
            if (env.allowedOrigins.includes(origin)) return callback(null, true);
            callback(new Error(`Origin ${origin} is not allowed`));
        },
    };
}

export function createApp(
    env: Env,
    auth: Auth,
    tokenStore: TokenStore,
): Express {
    const app = express();

    app.use(cors(corsOptions(env)));
    app.use(express.json());

    app.get("/", (_req: Request, res: Response) => {
        res.status(200).json({ service: "mount-vernon-trail-backend", ok: true });
    });

    app.use(createAdminAuthRouter(auth, tokenStore));
    app.use("/api", requireFirebaseAuth(auth), createApiRouter(env, tokenStore));

    app.use(
        (
            error: unknown,
            _req: Request,
            res: Response,
            next: NextFunction,
        ): Response | void => {
            if (res.headersSent) return next(error);
            if (error instanceof MulterError) {
                const tooBig = error.code === "LIMIT_FILE_SIZE";
                return res.status(tooBig ? 413 : 400).json({
                    error: tooBig
                        ? `Each photo must be under ${Math.floor(env.maxUploadBytesPerFile / 1024 / 1024)} MB`
                        : `Upload rejected: ${error.message}`,
                    code: error.code,
                });
            }
            if (error instanceof Error && error.message.includes("is not allowed")) {
                return res.status(403).json({ error: error.message });
            }
            console.error("Unhandled error:", error);
            return res.status(500).json({ error: "Internal server error" });
        },
    );

    return app;
}
