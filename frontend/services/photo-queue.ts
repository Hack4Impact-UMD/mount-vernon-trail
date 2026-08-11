import { uploadPhotos, type PhotoUpload } from "@/api/backend-client";
import { getErrorMessage } from "@/utils/errors";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Volunteers document the trail with no reliable signal, so capture must never
// block on the network. A photo is written here the moment it is taken and
// uploaded whenever the upload succeeds — opportunistically after capture, and
// again when the event is stopped. Persisted, so nothing is lost to a
// navigation, a backgrounded app, or a crash.

const STORAGE_KEY = "photo-queue:v1";

export type PhotoSlot = "before" | "after";

export type PhotoStatus = "pending" | "uploaded" | "failed";

export type QueuedPhoto = {
    id: string;
    eventId: string;
    albumId: string;
    issueId: string;
    issueName: string;
    slot: PhotoSlot;
    uri: string;
    createdAt: number;
    status: PhotoStatus;
    error?: string;
};

export type IssuePhotos = Record<string, { before?: QueuedPhoto; after?: QueuedPhoto }>;

type Listener = () => void;

const listeners = new Set<Listener>();
let cache: QueuedPhoto[] | null = null;
let flushing: Promise<void> | null = null;

export function subscribeToPhotoQueue(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

function notify(): void {
    for (const listener of listeners) listener();
}

async function readAll(): Promise<QueuedPhoto[]> {
    if (cache) return cache;
    try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        cache = raw ? (JSON.parse(raw) as QueuedPhoto[]) : [];
    } catch (error) {
        console.error("Could not read the photo queue:", getErrorMessage(error));
        cache = [];
    }
    return cache;
}

async function writeAll(photos: QueuedPhoto[]): Promise<void> {
    cache = photos;
    try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(photos));
    } catch (error) {
        // The in-memory cache still holds the photo, so the current session
        // keeps working; only persistence across a restart is lost.
        console.error("Could not persist the photo queue:", getErrorMessage(error));
    }
    notify();
}

export type EnqueueInput = {
    eventId: string;
    albumId: string;
    issueId: string;
    issueName: string;
    slot: PhotoSlot;
    uri: string;
};

// One photo per (issue, slot): retaking replaces rather than accumulates.
export async function enqueuePhoto(input: EnqueueInput): Promise<QueuedPhoto> {
    const photos = await readAll();
    const photo: QueuedPhoto = {
        ...input,
        id: `${input.eventId}:${input.issueId}:${input.slot}`,
        createdAt: Date.now(),
        status: "pending",
    };
    await writeAll([...photos.filter((p) => p.id !== photo.id), photo]);
    return photo;
}

export async function getPhotosForEvent(eventId: string): Promise<QueuedPhoto[]> {
    return (await readAll()).filter((photo) => photo.eventId === eventId);
}

export async function getIssuePhotos(eventId: string): Promise<IssuePhotos> {
    const photos = await getPhotosForEvent(eventId);
    const byIssue: IssuePhotos = {};
    for (const photo of photos) {
        byIssue[photo.issueId] = { ...byIssue[photo.issueId], [photo.slot]: photo };
    }
    return byIssue;
}

export async function getPendingCount(eventId: string): Promise<number> {
    return (await getPhotosForEvent(eventId)).filter(
        (photo) => photo.status !== "uploaded",
    ).length;
}

export async function removePhoto(photoId: string): Promise<void> {
    const photos = await readAll();
    await writeAll(photos.filter((photo) => photo.id !== photoId));
}

function fileNameFor(photo: QueuedPhoto): string {
    const safeIssue = photo.issueName.replace(/[^a-zA-Z0-9-_]+/g, "-").slice(0, 40);
    const extension = photo.uri.split(".").pop()?.toLowerCase();
    const suffix = extension && extension.length <= 4 ? extension : "jpg";
    return `${safeIssue || "issue"}-${photo.slot}.${suffix}`;
}

function mimeTypeFor(uri: string): string {
    return uri.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
}

export type FlushResult = {
    uploaded: number;
    failed: number;
};

// Uploads everything still pending for an event, grouped by album so each
// album needs only one request. Safe to call repeatedly; already-uploaded
// photos are skipped and a failure leaves the photo queued for the next try.
export async function flushEventPhotos(eventId: string): Promise<FlushResult> {
    if (flushing) await flushing;

    let result: FlushResult = { uploaded: 0, failed: 0 };
    flushing = (async () => {
        const photos = await readAll();
        const pending = photos.filter(
            (photo) => photo.eventId === eventId && photo.status !== "uploaded",
        );
        if (pending.length === 0) return;

        const byAlbum = new Map<string, QueuedPhoto[]>();
        for (const photo of pending) {
            byAlbum.set(photo.albumId, [...(byAlbum.get(photo.albumId) ?? []), photo]);
        }

        const updates = new Map<string, QueuedPhoto>();
        for (const [albumId, albumPhotos] of byAlbum) {
            const payload: PhotoUpload[] = albumPhotos.map((photo) => ({
                uri: photo.uri,
                fileName: fileNameFor(photo),
                mimeType: mimeTypeFor(photo.uri),
                description: `${photo.issueName} — ${photo.slot}`,
            }));
            try {
                const { failed } = await uploadPhotos(albumId, payload);
                const failedNames = new Set(failed.map((entry) => entry.fileName));
                for (const photo of albumPhotos) {
                    const failure = failedNames.has(fileNameFor(photo));
                    updates.set(photo.id, {
                        ...photo,
                        status: failure ? "failed" : "uploaded",
                        error: failure ? "Upload failed" : undefined,
                    });
                    if (failure) result.failed++;
                    else result.uploaded++;
                }
            } catch (error) {
                const message = getErrorMessage(error);
                for (const photo of albumPhotos) {
                    updates.set(photo.id, {
                        ...photo,
                        status: "failed",
                        error: message,
                    });
                    result.failed++;
                }
            }
        }

        const latest = await readAll();
        await writeAll(latest.map((photo) => updates.get(photo.id) ?? photo));
    })();

    try {
        await flushing;
    } finally {
        flushing = null;
    }
    return result;
}

// Fire-and-forget upload right after capture: if there is signal the photo is
// already gone by the time the volunteer finishes the issue, and if not it just
// stays queued.
export function flushInBackground(eventId: string): void {
    flushEventPhotos(eventId).catch((error: unknown) => {
        console.error("Background photo upload failed:", getErrorMessage(error));
    });
}

export async function clearUploadedPhotos(eventId: string): Promise<void> {
    const photos = await readAll();
    await writeAll(
        photos.filter(
            (photo) => !(photo.eventId === eventId && photo.status === "uploaded"),
        ),
    );
}
