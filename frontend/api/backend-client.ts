import { auth } from "@/config/firebase";

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

    constructor(code: BackendErrorCode, message: string, status: number | null = null) {
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
            error instanceof Error ? error.message : "Could not get an ID token.",
        );
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function readErrorMessage(payload: unknown, fallback: string): string {
    if (isRecord(payload) && typeof payload.error === "string") return payload.error;
    return fallback;
}

async function toError(response: Response): Promise<BackendError> {
    const payload: unknown = await response.json().catch(() => null);
    const message = readErrorMessage(
        payload,
        `Request failed with status ${response.status}`,
    );
    if (response.status === 403) return new BackendError("FORBIDDEN", message, 403);
    if (response.status === 404) return new BackendError("NOT_FOUND", message, 404);
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
    const query = pageToken ? `?pageToken=${encodeURIComponent(pageToken)}` : "";
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
    const query = pageToken ? `?pageToken=${encodeURIComponent(pageToken)}` : "";
    const page = await getJson<Partial<GooglePhotosMediaPage>>(
        `/api/albums/${encodeURIComponent(albumId)}/photos${query}`,
    );
    return { mediaItems: page.mediaItems ?? [], nextPageToken: page.nextPageToken };
}

export async function getPhoto(photoId: string): Promise<GooglePhotosMediaItem> {
    return getJson<GooglePhotosMediaItem>(
        `/api/photos/${encodeURIComponent(photoId)}`,
    );
}

type UploadResponse = {
    newMediaItemResults?: unknown[];
    failed?: UploadFailure[];
};

// React Native's FormData accepts a {uri, name, type} part and streams the file
// from disk, so a multi-megabyte photo never has to be based64'd into JS memory.
export async function uploadPhotos(
    albumId: string,
    photos: PhotoUpload[],
): Promise<UploadResult> {
    if (photos.length === 0) return { created: 0, failed: [] };

    const buildBody = (): BodyInit => {
        const form = new FormData();
        form.append("albumId", albumId);
        for (const photo of photos) {
            form.append("photos", {
                uri: photo.uri,
                name: photo.fileName,
                type: photo.mimeType,
            } as unknown as Blob);
            form.append("descriptions", photo.description ?? "");
        }
        return form as unknown as BodyInit;
    };

    // Body is rebuilt per attempt: a FormData consumed by a failed request
    // cannot be replayed on the 401 retry.
    const response = await send("/api/upload", { method: "POST" }, buildBody);
    if (!response.ok && response.status !== 207) throw await toError(response);

    const payload = (await response.json()) as UploadResponse;
    return {
        created: payload.newMediaItemResults?.length ?? 0,
        failed: payload.failed ?? [],
    };
}
