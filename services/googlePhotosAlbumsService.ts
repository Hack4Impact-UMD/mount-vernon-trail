import {
    createAlbum,
    GooglePhotosAlbum,
    listAlbums,
} from "@/api/googlePhotosClient";

import { AuthError, getValidAccessToken } from "@/auth/google-auth";
import { auth } from "@/config/firebase";
import {
    collection,
    doc,
    getDocs,
    getFirestore,
    query,
    setDoc,
    where,
} from "firebase/firestore";

/**
 * Checks for an existing album with the same title.
 * Returns true if a duplicate exists, false otherwise.
 */
async function albumNameExists(title: string): Promise<boolean> {
    const db = getFirestore();
    const albumsRef = collection(db, "albums");
    const q = query(albumsRef, where("title", "==", title.toLowerCase()));
    const snapshot = await getDocs(q);
    return !snapshot.empty;
}

// Store created album in Firestore
async function storeAlbum(
    albumId: string,
    title: string,
    createdBy: string,
): Promise<void> {
    const db = getFirestore();
    await setDoc(doc(db, "albums", albumId), {
        albumId,
        title: title.toLowerCase(),
        createdBy,
    });
}

/**
 * Creates a new album in the authenticated user's Google Photos and stores it in Firestore. Throws an error if a duplicate album name is found.
 * Otherwise, returns the created album object.
 */
export async function createGoogleAlbum(
    title: string,
): Promise<GooglePhotosAlbum> {
    let accessToken: string;
    try {
        accessToken = await getValidAccessToken();
    } catch (error) {
        if (error instanceof AuthError) {
            throw error;
        }
        throw new AuthError(
            "TOKEN_RETRIEVAL_FAILED",
            `Failed to retrieve access token: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
    }

    // Retrieve user ID from current user
    const currentUser = auth.currentUser;
    if (!currentUser) {
        throw new AuthError(
            "NOT_AUTHENTICATED",
            "User is not authenticated. Please sign in to create an album.",
        );
    }
    const uid = currentUser.uid;

    // Check Firestore for duplicate name
    const exists = await albumNameExists(title);
    if (exists) {
        throw new Error(`An album named "${title}" already exists.`);
    }

    // Create album via Google Photos API
    const album = await createAlbum(accessToken, title);

    // Store in Firestore for future duplicate checks
    await storeAlbum(album.id, title, uid);

    return album;
}

// List all albums from Google Photos, handling pagination
export async function listAllAlbums(
    accessToken: string,
): Promise<GooglePhotosAlbum[]> {
    let albums: GooglePhotosAlbum[] = [];
    let pageToken: string | undefined = undefined;
    do {
        const { albums: newAlbums, nextPageToken } = await listAlbums(
            accessToken,
            pageToken,
        );
        albums.push(...newAlbums);
        pageToken = nextPageToken;
    } while (pageToken);
    return albums;
}
