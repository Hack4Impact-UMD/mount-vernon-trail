import { createAlbum, GooglePhotosAlbum } from "@/api/googlePhotosClient";
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
    const q = query(
        albumsRef,
        where("title", "==", title.toLowerCase()),
    );
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
 * Creates a new album in Google Photos and stores it in Firestore. Throws an error if a duplicate album name is found.
 * Otherwise, returns the created album object. 
 */
export async function createGoogleAlbum(
    accessToken: string,
    title: string,
    uid: string,
): Promise<GooglePhotosAlbum> {
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