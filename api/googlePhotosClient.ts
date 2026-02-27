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
}

const GOOGLE_PHOTOS_API_BASE = 'https://photoslibrary.googleapis.com/v1';

// Creates a new album in the user's Google Photos library. Returns the created album object.
export async function createAlbum(
    accessToken: string,
    title: string
): Promise<GooglePhotosAlbum> {
    const url = `${GOOGLE_PHOTOS_API_BASE}/albums`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
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
            errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`;

        if (response.status === 401 || response.status === 403) {
            throw new Error(
                `Google Photos authentication failed: ${errorMessage}`
            );
        }

        throw new Error(
            `Google Photos API error (status ${response.status}): ${errorMessage}`
        );
    }

    const data: GooglePhotosAlbum = await response.json();
    return data;
}
