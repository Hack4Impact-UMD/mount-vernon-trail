import { Router, type Request, type Response } from "express";
import multer from "multer";
import { mapSettledWithLimit } from "../concurrency";
import type { Env } from "../env";
import {
	GooglePhotosError,
	PhotoByteTransferError,
	sendError,
} from "../errors";
import { withEventLock, type LockStore } from "../event-lock";
import * as photos from "../google-photos";
import { syncEventToGoogleSheets } from "../google-sheets";
import type { TokenStore } from "../google-tokens";
import { requireAdmin } from "../middleware/auth";
import type { SheetEvent } from "../sheet-row";

export type EventReader = (
    eventId: string,
) => Promise<Record<string, unknown> | null>;

const UPLOAD_CONCURRENCY = 4;

type FailedUpload = {
    fileName: string;
    error: string;
    retryable?: boolean;
    retryAfterMs?: number;
};

type BatchCreateResult = {
    newMediaItemResults?: unknown[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function batchFailure(result: unknown): string | null {
    if (!isRecord(result)) return "Google Photos did not confirm this upload";
    const status = result.status;
    if (isRecord(status) && status.code !== undefined && status.code !== 0) {
        return typeof status.message === "string" && status.message.trim()
            ? status.message
            : "Google Photos did not create this photo";
    }
    // A successful response can contain status: {code: 0} or status: {}.
    // Require a media item, rather than treating an empty result as success.
    return isRecord(result.mediaItem) &&
        typeof result.mediaItem.id === "string" &&
        result.mediaItem.id
        ? null
        : "Google Photos did not confirm this upload";
}

function readString(value: unknown): string | null {
    return typeof value === "string" && value.trim() !== ""
        ? value.trim()
        : null;
}

// Express 5 types a route param as string | string[]; these routes only ever
// declare a single-segment param, so collapse a repeat to its first value.
function readParam(value: string | string[]): string {
    return Array.isArray(value) ? (value[0] ?? "") : value;
}

// Descriptions arrive as a repeated multipart field, aligned positionally with
// `photos`. Multer gives a string for one value and an array for several.
function readDescriptions(value: unknown): string[] {
    if (Array.isArray(value)) return value.map((entry) => String(entry));
    if (typeof value === "string") return [value];
    return [];
}

function asDate(value: unknown): Date | null {
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value;
    }
    if (
        typeof value === "object" &&
        value !== null &&
        "toDate" in value &&
        typeof value.toDate === "function"
    ) {
        const date = value.toDate();
        return date instanceof Date && !Number.isNaN(date.getTime())
            ? date
            : null;
    }
    if (typeof value === "string" || typeof value === "number") {
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? null : date;
    }
    return null;
}

function toSheetEvent(
    eventId: string,
    document: Record<string, unknown>,
): SheetEvent | null {
    const date = asDate(document.date);
    if (
        document.eventId !== eventId ||
        typeof document.title !== "string" ||
        !date ||
        typeof document.eventLeader !== "string"
    ) {
        return null;
    }
    const metrics: Record<string, number> = {};
    if (
        typeof document.metrics === "object" &&
        document.metrics !== null &&
        !Array.isArray(document.metrics)
    ) {
        for (const [key, value] of Object.entries(document.metrics)) {
            if (typeof value === "number" && Number.isFinite(value)) {
                metrics[key] = value;
            }
        }
    }
    return {
        eventId,
        title: document.title,
        date,
        startDate: asDate(document.startDate),
        endDate: asDate(document.endDate),
        eventLeader: document.eventLeader,
        metrics,
    };
}

export function createApiRouter(
    env: Env,
    tokenStore: TokenStore,
    readEvent: EventReader,
    locks: LockStore,
): Router {
    const router = Router();
    const upload = multer({
        storage: multer.memoryStorage(),
        limits: {
            fileSize: env.maxUploadBytesPerFile,
            files: env.maxUploadFiles,
        },
    });

    router.get("/auth/status", async (_req: Request, res: Response) => {
        try {
            return res
                .status(200)
                .json({ authenticated: await tokenStore.isAuthenticated() });
        } catch (error) {
            return sendError(
                res,
                "Could not check authentication status",
                error,
            );
        }
    });

    router.post(
        "/events/:eventId/sheets",
        async (req: Request, res: Response) => {
            if (!env.googleSheetsSpreadsheetId) {
                return res.status(503).json({
                    error: "Google Sheets export is not configured",
                });
            }
            const eventId = readParam(req.params.eventId);
            if (!eventId) {
                return res.status(400).json({ error: "eventId is required" });
            }

            try {
                const document = await readEvent(eventId);
                if (!document) {
                    return res.status(404).json({ error: "Event not found" });
                }
                if (!req.user?.admin && document.startedBy !== req.user?.uid) {
                    return res.status(403).json({
                        error: "Only the event owner or an admin can export it",
                    });
                }
                if (!asDate(document.endDate)) {
                    return res.status(409).json({
                        error: "The event must be ended before it can be exported",
                    });
                }
                const event = toSheetEvent(eventId, document);
                if (!event) {
                    return res.status(422).json({
                        error: "The event is missing fields required for Sheets export",
                    });
                }

                const spreadsheetId = env.googleSheetsSpreadsheetId;
                await withEventLock(locks, eventId, async (signal) => {
                    const token = await tokenStore.getAccessToken();
                    await syncEventToGoogleSheets(
                        token,
                        spreadsheetId,
                        env.googleSheetsEventsTab,
                        env.googleSheetsImprovementsTab,
                        event,
                        signal,
                    );
                });
                return res.status(200).json({ synced: true, eventId });
            } catch (error) {
                return sendError(
                    res,
                    "Failed to sync event to Google Sheets",
                    error,
                );
            }
        },
    );

    router.post(
        "/upload",
        upload.array("photos", env.maxUploadFiles),
        async (req: Request, res: Response) => {
            const files = req.files as Express.Multer.File[] | undefined;
            if (!files || files.length === 0) {
                return res
                    .status(400)
                    .json({ error: "at least one photo is required" });
            }
            const albumId = readString(req.body?.albumId);
            if (!albumId) {
                return res.status(400).json({ error: "albumId is required" });
            }
            const descriptions = readDescriptions(req.body?.descriptions);

            try {
                const token = await tokenStore.getAccessToken();

                const uploads = await mapSettledWithLimit(
                    files,
                    UPLOAD_CONCURRENCY,
                    (file) =>
                        photos.uploadBytes(
                            token,
                            new Uint8Array(file.buffer),
                            file.mimetype,
                        ),
                );

                const items: photos.NewMediaItem[] = [];
                const failed: FailedUpload[] = [];
                for (const result of uploads) {
                    const file = files[result.index];
                    if (result.ok) {
                        items.push({
                            uploadToken: result.value,
                            fileName: file.originalname,
                            description: descriptions[result.index],
                        });
                    } else {
                        failed.push({
                            fileName: file.originalname,
                            ...(result.error instanceof GooglePhotosError &&
                            result.error.status === 429
                                ? {
                                      retryable: true,
                                      retryAfterMs: result.error.retryAfterMs,
                                  }
                                : result.error instanceof
                                        PhotoByteTransferError ||
                                    (result.error instanceof
                                        GooglePhotosError &&
                                        [408, 500, 502, 503, 504].includes(
                                            result.error.status,
                                        ))
                                  ? { retryable: true }
                                  : {}),
                            error:
                                result.error instanceof Error
                                    ? result.error.message
                                    : "upload failed",
                        });
                    }
                }

                // Every byte upload failed — nothing to attach, so this is a
                // clean total failure rather than a partial success.
                if (items.length === 0) {
                    return res.status(502).json({
                        error: "Google Photos upload failed",
                        failed,
                    });
                }

                const created = (await photos.batchCreate(
                    token,
                    albumId,
                    items,
                )) as BatchCreateResult;
                const results = created.newMediaItemResults ?? [];
                const succeeded: string[] = [];
                for (const [index, item] of items.entries()) {
                    const result = results[index];
                    const error = batchFailure(result);
                    if (result === undefined || error) {
                        failed.push({
                            fileName: item.fileName,
                            ...(isRecord(result) &&
                            isRecord(result.status) &&
                            result.status.code === 8
                                ? { retryable: true, retryAfterMs: 30_000 }
                                : {}),
                            error:
                                error ??
                                "Google Photos did not return a result for this photo",
                        });
                    } else {
                        succeeded.push(item.fileName);
                    }
                }
                return res.status(failed.length > 0 ? 207 : 201).json({
                    created: succeeded.length,
                    succeeded,
                    failed,
                });
            } catch (error) {
                return sendError(res, "Failed to upload photos", error);
            }
        },
    );

    router.post(
        "/graphics",
        requireAdmin,
        upload.single("photo"),
        async (req: Request, res: Response) => {
            const file = req.file;
            if (!file) {
                return res.status(400).json({ error: "photo is required" });
            }
            if (!file.mimetype.startsWith("image/")) {
                return res
                    .status(400)
                    .json({ error: "photo must be an image" });
            }
            const albumId = readString(req.body?.albumId);
            if (!albumId) {
                return res.status(400).json({ error: "albumId is required" });
            }
            const description = readString(req.body?.description) ?? "";

            try {
                const token = await tokenStore.getAccessToken();
                const uploadToken = await photos.uploadBytes(
                    token,
                    new Uint8Array(file.buffer),
                    file.mimetype,
                );
                const created = (await photos.batchCreate(token, albumId, [
                    {
                        uploadToken,
                        fileName: file.originalname,
                        description,
                    },
                ])) as BatchCreateResult;
                const result = created.newMediaItemResults?.[0];
                const failure = batchFailure(result);
                if (result === undefined || failure) {
                    return res.status(502).json({
                        error:
                            failure ??
                            "Google Photos did not create this graphic",
                    });
                }
                return res.status(201).json({ created: true });
            } catch (error) {
                return sendError(res, "Failed to upload graphic", error);
            }
        },
    );

    router.post("/albums", async (req: Request, res: Response) => {
        const title = readString(req.body?.title);
        if (!title) {
            return res.status(400).json({ error: "title is required" });
        }
        try {
            const token = await tokenStore.getAccessToken();
            return res.status(201).json(await photos.createAlbum(token, title));
        } catch (error) {
            return sendError(res, "Failed to create album", error);
        }
    });

    router.get("/albums", async (req: Request, res: Response) => {
        try {
            const token = await tokenStore.getAccessToken();
            const pageToken = readString(req.query.pageToken) ?? undefined;
            return res
                .status(200)
                .json(await photos.listAlbums(token, pageToken));
        } catch (error) {
            return sendError(res, "Failed to list albums", error);
        }
    });

    router.get("/albums/:albumId", async (req: Request, res: Response) => {
        try {
            const token = await tokenStore.getAccessToken();
            return res
                .status(200)
                .json(
                    await photos.getAlbum(token, readParam(req.params.albumId)),
                );
        } catch (error) {
            return sendError(res, "Failed to fetch album", error);
        }
    });

    router.get(
        "/albums/:albumId/photos",
        async (req: Request, res: Response) => {
            try {
                const token = await tokenStore.getAccessToken();
                const pageToken = readString(req.query.pageToken) ?? undefined;
                return res
                    .status(200)
                    .json(
                        await photos.searchAlbumPhotos(
                            token,
                            readParam(req.params.albumId),
                            pageToken,
                        ),
                    );
            } catch (error) {
                return sendError(res, "Failed to list photos", error);
            }
        },
    );

    router.get("/photos/:photoId", async (req: Request, res: Response) => {
        try {
            const token = await tokenStore.getAccessToken();
            return res
                .status(200)
                .json(
                    await photos.getMediaItem(
                        token,
                        readParam(req.params.photoId),
                    ),
                );
        } catch (error) {
            return sendError(res, "Failed to fetch photo", error);
        }
    });

    return router;
}
