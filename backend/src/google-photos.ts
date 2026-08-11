import { GooglePhotosError } from "./errors";

const API_BASE = "https://photoslibrary.googleapis.com/v1";

// fetch applies no deadline of its own. These calls run on the Express request
// path, so a stalled Google connection would hold the socket, the buffered file
// and one of the upload concurrency slots until the socket eventually breaks —
// which exhausts memory on a 512 MB instance under load.
const REQUEST_TIMEOUT_MS = 30_000;
const UPLOAD_TIMEOUT_MS = 120_000;

export type NewMediaItem = {
    uploadToken: string;
    fileName: string;
    description?: string;
};

async function request(
    token: string,
    path: string,
    init: RequestInit = {},
): Promise<unknown> {
    const response = await fetch(`${API_BASE}${path}`, {
        ...init,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            ...init.headers,
        },
    });
    if (!response.ok) {
        throw new GooglePhotosError(response.status, await response.text());
    }
    return response.json();
}

export async function uploadBytes(
    token: string,
    bytes: Uint8Array<ArrayBuffer>,
    mimeType: string,
): Promise<string> {
    const response = await fetch(`${API_BASE}/uploads`, {
        method: "POST",
        // Longer than the JSON calls: this one streams multi-megabyte photos.
        signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/octet-stream",
            "X-Goog-Upload-Content-Type": mimeType,
            "X-Goog-Upload-Protocol": "raw",
        },
        body: new Blob([bytes]),
    });
    if (!response.ok) {
        throw new GooglePhotosError(response.status, await response.text());
    }
    return response.text();
}

export async function batchCreate(
    token: string,
    albumId: string,
    items: NewMediaItem[],
): Promise<unknown> {
    return request(token, "/mediaItems:batchCreate", {
        method: "POST",
        body: JSON.stringify({
            albumId,
            newMediaItems: items.map((item) => ({
                // Preserved end to end: the frontend photo model carries a
                // per-photo description that the previous implementation dropped.
                description: item.description ?? "",
                simpleMediaItem: {
                    fileName: item.fileName,
                    uploadToken: item.uploadToken,
                },
            })),
        }),
    });
}

export async function createAlbum(
    token: string,
    title: string,
): Promise<unknown> {
    return request(token, "/albums", {
        method: "POST",
        body: JSON.stringify({ album: { title } }),
    });
}

export async function getAlbum(
    token: string,
    albumId: string,
): Promise<unknown> {
    return request(token, `/albums/${encodeURIComponent(albumId)}`);
}

export async function listAlbums(
    token: string,
    pageToken?: string,
): Promise<unknown> {
    const params = new URLSearchParams({ pageSize: "50" });
    if (pageToken) params.set("pageToken", pageToken);
    return request(token, `/albums?${params.toString()}`);
}

export async function searchAlbumPhotos(
    token: string,
    albumId: string,
    pageToken?: string,
): Promise<unknown> {
    const body: Record<string, unknown> = { albumId, pageSize: 100 };
    if (pageToken) body.pageToken = pageToken;
    return request(token, "/mediaItems:search", {
        method: "POST",
        body: JSON.stringify(body),
    });
}

export async function getMediaItem(
    token: string,
    photoId: string,
): Promise<unknown> {
    return request(token, `/mediaItems/${encodeURIComponent(photoId)}`);
}
