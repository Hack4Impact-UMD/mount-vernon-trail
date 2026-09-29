import { auth } from "@/config/firebase";
import { File } from "expo-file-system";

// Photos live in the MVT-owned Google account, reachable only through our
// backend proxy. The app holds no Google Photos credentials of its own — it
// authenticates to the proxy with the signed-in volunteer's Firebase ID token.

export type GooglePhotosAlbum = {
    id: string;
    title: string;
    productUrl?: string;
    isWriteable?: boolean;
    // Google returns this as a string; callers coerce where they need a number.
    mediaItemsCount?: string;
    coverPhotoBaseUrl?: string;
    coverPhotoMediaItemId?: string;
};

export type GooglePhotosAlbumsPage = {
    albums: GooglePhotosAlbum[];
    nextPageToken?: string;
};

export type GooglePhotosMediaItem = {
    id: string;
    description?: string;
    productUrl?: string;
    baseUrl?: string;
    mimeType?: string;
    filename?: string;
};

export type GooglePhotosMediaPage = {
    mediaItems: GooglePhotosMediaItem[];
    nextPageToken?: string;
};

export type PhotoUpload = {
    uri: string;
    fileName: string;
    mimeType: string;
    description?: string;
};

export type UploadFailure = { fileName: string; error: string };

export type UploadResult = {
    created: number;
    succeeded: string[];
    failed: UploadFailure[];
};

export type BackendErrorCode =
    | "NOT_CONFIGURED"
    | "NOT_SIGNED_IN"
    | "UNAUTHORIZED"
    | "FORBIDDEN"
    | "NOT_FOUND"
    | "UPSTREAM"
    | "NETWORK"
    | "UNKNOWN";

export class BackendError extends Error {
    readonly code: BackendErrorCode;
    readonly status: number | null;

    constructor(
        code: BackendErrorCode,
        message: string,
        status: number | null = null,
    ) {
        super(message);
        this.name = "BackendError";
        this.code = code;
        this.status = status;
    }
}

function baseUrl(): string {
    const url = process.env.EXPO_PUBLIC_BACKEND_URL?.trim();
    if (!url) {
        throw new BackendError(
            "NOT_CONFIGURED",
            "EXPO_PUBLIC_BACKEND_URL is not set. Photo features need the backend " +
                "proxy — see frontend/.env.example.",
        );
    }
    return url.replace(/\/+$/, "");
}

async function idToken(forceRefresh: boolean): Promise<string> {
    const user = auth.currentUser;
    if (!user) {
        throw new BackendError(
            "NOT_SIGNED_IN",
            "You are signed out. Sign in again to continue.",
        );
    }
    try {
        return await user.getIdToken(forceRefresh);
    } catch (error) {
        throw new BackendError(
            "NOT_SIGNED_IN",
            error instanceof Error
                ? error.message
                : "Could not get an ID token.",
        );
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function readErrorMessage(payload: unknown, fallback: string): string {
    if (isRecord(payload) && typeof payload.error === "string")
        return payload.error;
    return fallback;
}

async function toError(response: Response): Promise<BackendError> {
    const payload: unknown = await response.json().catch(() => null);
    const message = readErrorMessage(
        payload,
        `Request failed with status ${response.status}`,
    );
    if (response.status === 403)
        return new BackendError("FORBIDDEN", message, 403);
    if (response.status === 404)
        return new BackendError("NOT_FOUND", message, 404);
    if (response.status === 502) {
        return new BackendError(
            "UPSTREAM",
            "Google Photos is unavailable right now. Please try again.",
            502,
        );
    }
    if (response.status === 401) {
        return new BackendError("UNAUTHORIZED", message, 401);
    }
    return new BackendError("UNKNOWN", message, response.status);
}

// Sends the request, and on a 401 retries exactly once with a force-refreshed
// ID token — the token is only an hour long, so an expiry mid-session is
// routine rather than exceptional.
async function send(
    path: string,
    init: RequestInit,
    body?: () => BodyInit,
): Promise<Response> {
    // Resolved before the try so a misconfiguration is not reported as a
    // network failure.
    const url = `${baseUrl()}${path}`;

    async function attempt(forceRefresh: boolean): Promise<Response> {
        const token = await idToken(forceRefresh);
        try {
            return await fetch(url, {
                ...init,
                headers: { ...init.headers, Authorization: `Bearer ${token}` },
                ...(body ? { body: body() } : {}),
            });
        } catch (error) {
            throw new BackendError(
                "NETWORK",
                error instanceof Error
                    ? `Could not reach the server: ${error.message}`
                    : "Could not reach the server.",
            );
        }
    }

    const first = await attempt(false);
    if (first.status !== 401) return first;
    return attempt(true);
}

async function getJson<T>(path: string): Promise<T> {
    const response = await send(path, { method: "GET" });
    if (!response.ok) throw await toError(response);
    return (await response.json()) as T;
}

async function postJson<T>(path: string, payload: unknown): Promise<T> {
    const response = await send(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    if (!response.ok) throw await toError(response);
    return (await response.json()) as T;
}

export async function createAlbum(title: string): Promise<GooglePhotosAlbum> {
    return postJson<GooglePhotosAlbum>("/api/albums", { title });
}

export async function getAlbum(albumId: string): Promise<GooglePhotosAlbum> {
    return getJson<GooglePhotosAlbum>(
        `/api/albums/${encodeURIComponent(albumId)}`,
    );
}

export async function listAlbumsPage(
    pageToken?: string,
): Promise<GooglePhotosAlbumsPage> {
    const query = pageToken
        ? `?pageToken=${encodeURIComponent(pageToken)}`
        : "";
    const page = await getJson<Partial<GooglePhotosAlbumsPage>>(
        `/api/albums${query}`,
    );
    return { albums: page.albums ?? [], nextPageToken: page.nextPageToken };
}

export async function listAllAlbums(): Promise<GooglePhotosAlbum[]> {
    const albums: GooglePhotosAlbum[] = [];
    let pageToken: string | undefined;
    do {
        const page = await listAlbumsPage(pageToken);
        albums.push(...page.albums);
        pageToken = page.nextPageToken;
    } while (pageToken);
    return albums;
}

export async function listAlbumPhotos(
    albumId: string,
    pageToken?: string,
): Promise<GooglePhotosMediaPage> {
    const query = pageToken
        ? `?pageToken=${encodeURIComponent(pageToken)}`
        : "";
    const page = await getJson<Partial<GooglePhotosMediaPage>>(
        `/api/albums/${encodeURIComponent(albumId)}/photos${query}`,
    );
    return {
        mediaItems: page.mediaItems ?? [],
        nextPageToken: page.nextPageToken,
    };
}

export async function getPhoto(
    photoId: string,
): Promise<GooglePhotosMediaItem> {
    return getJson<GooglePhotosMediaItem>(
        `/api/photos/${encodeURIComponent(photoId)}`,
    );
}

type UploadResponse = {
    created?: number;
    succeeded?: string[];
    failed?: UploadFailure[];
};

type MultipartPart =
    | { name: string; value: string }
    | { name: string; fileName: string; mimeType: string; bytes: Uint8Array };

// Quotes, CR and LF would break out of the Content-Disposition header.
function headerSafe(value: string): string {
    return value.replace(/["\r\n]/g, "_");
}

function encodeMultipart(parts: MultipartPart[], boundary: string): Uint8Array {
    const encoder = new TextEncoder();
    const chunks: Uint8Array[] = [];
    for (const part of parts) {
        let head = `--${boundary}\r\nContent-Disposition: form-data; name="${headerSafe(part.name)}"`;
        if ("bytes" in part) {
            head +=
                `; filename="${headerSafe(part.fileName)}"\r\n` +
                `Content-Type: ${part.mimeType}`;
        }
        chunks.push(encoder.encode(`${head}\r\n\r\n`));
        chunks.push("bytes" in part ? part.bytes : encoder.encode(part.value));
        chunks.push(encoder.encode("\r\n"));
    }
    chunks.push(encoder.encode(`--${boundary}--\r\n`));

    const body = new Uint8Array(
        chunks.reduce((sum, chunk) => sum + chunk.length, 0),
    );
    let offset = 0;
    for (const chunk of chunks) {
        body.set(chunk, offset);
        offset += chunk.length;
    }
    return body;
}

async function uploadPhoto(
    albumId: string,
    photo: PhotoUpload,
): Promise<UploadResult> {
    const file = new File(photo.uri);
    if (!file.exists) {
        return {
            created: 0,
            succeeded: [],
            failed: [
                {
                    fileName: photo.fileName,
                    error: "The photo file is no longer on this device. Retake the photo.",
                },
            ],
        };
    }

    const parts: MultipartPart[] = [
        { name: "albumId", value: albumId },
        {
            name: "photos",
            fileName: photo.fileName,
            mimeType: photo.mimeType,
            bytes: await file.bytes(),
        },
        { name: "descriptions", value: photo.description ?? "" },
    ];
    const boundary = `----MVTUploadBoundary${Date.now().toString(16)}${Math.random()
        .toString(16)
        .slice(2)}`;

    // Body is rebuilt per attempt so a request that consumed it cannot leave
    // the 401 retry with nothing to send.
    const response = await send(
        "/api/upload",
        {
            method: "POST",
            headers: {
                "Content-Type": `multipart/form-data; boundary=${boundary}`,
            },
        },
        () => encodeMultipart(parts, boundary) as unknown as BodyInit,
    );
    if (!response.ok && response.status !== 207) throw await toError(response);

    const payload = (await response.json()) as UploadResponse;
    const succeeded = payload.succeeded?.includes(photo.fileName)
        ? [photo.fileName]
        : [];
    const failed = payload.failed ?? [];
    if (succeeded.length === 0 && failed.length === 0) {
        failed.push({
            fileName: photo.fileName,
            error: "The server did not confirm that this photo was created",
        });
    }
    return {
        created: succeeded.length,
        succeeded,
        failed,
    };
}

// A request holds one file plus one encoded copy in JS memory. Sending photos
// one at a time avoids both the backend's file-count limit and mobile OOMs.
export async function uploadPhotos(
    albumId: string,
    photos: PhotoUpload[],
): Promise<UploadResult> {
    const result: UploadResult = { created: 0, succeeded: [], failed: [] };
    for (const photo of photos) {
        try {
            const uploaded = await uploadPhoto(albumId, photo);
            result.created += uploaded.created;
            result.succeeded.push(...uploaded.succeeded);
            result.failed.push(...uploaded.failed);
        } catch (error) {
            result.failed.push({
                fileName: photo.fileName,
                error:
                    error instanceof Error
                        ? error.message
                        : "Photo upload failed",
            });
        }
    }
    return result;
}
