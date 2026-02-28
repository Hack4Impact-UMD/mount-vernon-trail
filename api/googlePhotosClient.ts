/**
 * Google Photos Library API client.
 * Handles raw HTTP calls to the Google Photos API.
 */

/**
 * Google Photos album object as returned by the API.
 * There are some other fields, but the id and title should be most important for now.
 */

export interface GooglePhotosAlbum {
    id: string;
    title: string;
    productUrl?: string;
    isWriteable?: boolean;
    coverPhotoBaseUrl?: string;
}

export interface GooglePhotosAlbumsResponse {
    albums: GooglePhotosAlbum[];
}

export interface GooglePhotosMediaItem {
    uploadToken: string;
    status: {
        message: string;
    };
    mediaItem?: {
        id: string;
        description: string;
        productUrl: string;
        mimeType: string;
        mediaMetadata: {
            width: string;
            height: string;
            creationTime: string;
        };
        filename: string;
    };
}

const GOOGLE_PHOTOS_API_BASE = "https://photoslibrary.googleapis.com/v1";

// Creates a new album in the user's Google Photos library. Returns the created album object.
export async function createAlbum(
    accessToken: string,
    title: string,
): Promise<GooglePhotosAlbum> {
    const url = `${GOOGLE_PHOTOS_API_BASE}/albums`;

    const response = await fetch(url, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            album: {
                title,
            },
        }),
    });

    // Error handling
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage =
            errorData.error?.message ||
            `HTTP ${response.status}: ${response.statusText}`;

        if (response.status === 401 || response.status === 403) {
            throw new Error(
                `Google Photos authentication failed: ${errorMessage}`,
            );
        }

        throw new Error(
            `Google Photos API error (status ${response.status}): ${errorMessage}`,
        );
    }

    const data: GooglePhotosAlbum = await response.json();
    return data;
}

// Lists albums in the user's Google Photos library. Returns an array of album objects.
export async function listAlbums(
    accessToken: string,
): Promise<GooglePhotosAlbum[]> {
    const url = `${GOOGLE_PHOTOS_API_BASE}/albums`;
    const response = await fetch(url, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    });
    if (!response.ok) {
        // TODO add better error handling in the future
        throw new Error(
            `Failed to receive albums: ${response.status}: ${response.statusText}`,
        );
    }
    const data = await response.json();
    return data?.albums ?? [];
}

// Upload photo to Google Photos. Returns an upload token that is
// used to create a media item in an album
export async function uploadPhotoBytes(
    accessToken: string,
    imageUri: string,
): Promise<string> {
    const uploadURL = `${GOOGLE_PHOTOS_API_BASE}/uploads`;
    const imageResponse = await fetch(imageUri);
    const imageBlob = await imageResponse.blob();
    const response = await fetch(uploadURL, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/octet-stream",
            "X-Goog-Upload-Content-Type": "image/jpeg",
            "X-Goog-Upload-Protocol": "raw",
        },
        body: imageBlob,
    });
    if (!response.ok) {
        // TODO add better error handling in the future
        throw new Error(
            `Failed to upload photo: ${response.status}: ${response.statusText}`,
        );
    }
    return await response.text();
}

// Create media items in a specific album using upload tokens
// Returns an array of media item results with status (success or error)
export async function createMediaItems(
    accessToken: string,
    albumId: string,
    uploadTokens: string[],
    names?: string[],
    descriptions?: string[],
): Promise<GooglePhotosMediaItem[]> {
    if (uploadTokens.length > 50) {
        throw new Error("Cannot create more than 50 media items at once");
    }
    const url = `${GOOGLE_PHOTOS_API_BASE}/mediaItems:batchCreate`;
    const response = await fetch(url, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            albumId,
            newMediaItems: uploadTokens.map((token, idx) => {
                return {
                    description: descriptions?.[idx] ?? "",
                    simpleMediaItem: {
                        fileName: names?.[idx] ?? `photo-${idx}`,
                        uploadToken: token,
                    },
                };
            }),
        }),
    });
    if (!response.ok) {
        // TODO add better error handling in the future
        throw new Error(
            `Failed to create media items: ${response.status}: ${response.statusText}`,
        );
    }
    const data = await response.json();
    return data?.newMediaItemResults ?? [];
}
