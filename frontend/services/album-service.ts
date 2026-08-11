import { db } from "@/config/firebase";
import {
    collection,
    doc,
    getDoc,
    getDocs,
    runTransaction,
    Timestamp,
    writeBatch,
} from "firebase/firestore";
import { requireUser } from "./require-user";

export const ALBUMS_COLLECTION = "albums";
export const ALBUM_TITLES_COLLECTION = "albumTitles";

export type AlbumDoc = {
    albumId: string;
    title: string;
    titleLower: string;
    albumUrl: string;
    eventId: string | null;
    createdBy: string;
    createdAt: Timestamp;
};

export type AlbumReservationStatus = "pending" | "created";

export type AlbumReservation = {
    titleKey: string;
    title: string;
    titleLower: string;
    albumId: string | null;
    reservedBy: string;
    reservedAt: Timestamp;
    status: AlbumReservationStatus;
};

export type ReservedAlbumTitle = {
    titleKey: string;
    existingAlbumId: string | null;
};

export function normalizeAlbumTitle(title: string): string {
    return title.trim().toLowerCase().replace(/\s+/g, " ");
}

// Deterministic, legal Firestore document id: encodeURIComponent escapes "/",
// the "." replacement avoids "." and "..", and the prefix avoids the reserved
// __*__ pattern. A deterministic id is what makes the reservation atomic.
export function albumTitleKey(title: string): string {
    return `t_${encodeURIComponent(normalizeAlbumTitle(title)).replace(/\./g, "%2E")}`;
}

// Claims a title before any Google Photos call. Two concurrent creators of the
// same title cannot both pass: one commits, the other's transaction retries,
// re-reads the now-existing doc, and throws.
export async function reserveAlbumTitle(
    title: string,
): Promise<ReservedAlbumTitle> {
    const currentUser = requireUser("create an album");
    const titleKey = albumTitleKey(title);
    const ref = doc(db, ALBUM_TITLES_COLLECTION, titleKey);

    return runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(ref);
        if (snapshot.exists()) {
            const existing = snapshot.data() as AlbumReservation;
            if (existing.status === "created") {
                throw new Error(`An album named "${title.trim()}" already exists.`);
            }
            if (existing.reservedBy !== currentUser.uid) {
                throw new Error(
                    `An album named "${title.trim()}" is being created by someone else.`,
                );
            }
            // Our own half-finished attempt: hand the album back so a retry
            // reuses it instead of creating a second one.
            return { titleKey, existingAlbumId: existing.albumId };
        }
        transaction.set(ref, {
            titleKey,
            title: title.trim(),
            titleLower: normalizeAlbumTitle(title),
            albumId: null,
            reservedBy: currentUser.uid,
            reservedAt: Timestamp.now(),
            status: "pending",
        });
        return { titleKey, existingAlbumId: null };
    });
}

// Records the remote album id while the reservation is still pending. Google
// Photos has no album-delete endpoint, so an album created before a later step
// fails cannot be undone — recording it here lets a retry reuse it.
export async function markAlbumCreated(
    titleKey: string,
    albumId: string,
): Promise<void> {
    requireUser("create an album");
    await runTransaction(db, async (transaction) => {
        const ref = doc(db, ALBUM_TITLES_COLLECTION, titleKey);
        const snapshot = await transaction.get(ref);
        if (!snapshot.exists()) {
            throw new Error("Album title reservation disappeared.");
        }
        transaction.update(ref, { albumId });
    });
}

export async function finalizeAlbum(args: {
    titleKey: string;
    albumId: string;
    title: string;
    albumUrl: string;
}): Promise<void> {
    const currentUser = requireUser("create an album");
    const batch = writeBatch(db);
    const album: AlbumDoc = {
        albumId: args.albumId,
        title: args.title.trim(),
        titleLower: normalizeAlbumTitle(args.title),
        albumUrl: args.albumUrl,
        eventId: null,
        createdBy: currentUser.uid,
        createdAt: Timestamp.now(),
    };
    batch.set(doc(db, ALBUMS_COLLECTION, args.albumId), album);
    batch.update(doc(db, ALBUM_TITLES_COLLECTION, args.titleKey), {
        albumId: args.albumId,
        status: "created",
    });
    await batch.commit();
}

// Compensation for a failed setup. Only ever releases our own still-pending
// reservation, so it can never delete a title someone else finished with.
export async function releaseAlbumTitle(titleKey: string): Promise<void> {
    const currentUser = requireUser("create an album");
    await runTransaction(db, async (transaction) => {
        const ref = doc(db, ALBUM_TITLES_COLLECTION, titleKey);
        const snapshot = await transaction.get(ref);
        if (!snapshot.exists()) return;

        const reservation = snapshot.data() as AlbumReservation;
        if (reservation.status === "created") return;
        if (reservation.reservedBy !== currentUser.uid) {
            throw new Error("Cannot release an album title reserved by someone else.");
        }
        if (reservation.albumId) {
            transaction.delete(doc(db, ALBUMS_COLLECTION, reservation.albumId));
        }
        transaction.delete(ref);
    });
}

export async function albumNameExists(title: string): Promise<boolean> {
    const snapshot = await getDoc(
        doc(db, ALBUM_TITLES_COLLECTION, albumTitleKey(title)),
    );
    return (
        snapshot.exists() &&
        (snapshot.data() as AlbumReservation).status === "created"
    );
}

export async function linkAlbumToEvent(
    albumId: string,
    eventId: string,
    albumUrl: string,
): Promise<void> {
    const batch = writeBatch(db);
    batch.update(doc(db, ALBUMS_COLLECTION, albumId), { eventId, albumUrl });
    await batch.commit();
}

// albums.tsx pairs remote Google Photos albums with the date we recorded here.
export async function getAlbumCreatedAtMap(): Promise<Record<string, number>> {
    const snapshot = await getDocs(collection(db, ALBUMS_COLLECTION));
    const map: Record<string, number> = {};
    for (const albumDoc of snapshot.docs) {
        const data = albumDoc.data() as Partial<AlbumDoc>;
        if (data.createdAt) {
            map[albumDoc.id] = data.createdAt.toMillis();
        }
    }
    return map;
}
