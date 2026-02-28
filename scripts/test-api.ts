import {
    createAlbum,
    createMediaItems,
    listAlbums,
    uploadPhotoBytes,
} from "@/api/googlePhotosClient";
import dotenv from "dotenv";
dotenv.config();

const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

// Generate new access token using refresh token
async function getAccessToken(
    refreshToken: string,
    clientId: string,
    clientSecret: string,
): Promise<string> {
    const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: refreshToken,
            grant_type: "refresh_token",
        }),
    });
    if (!response.ok) {
        throw new Error(`Failed to get access token: ${response.statusText}`);
    }
    const data = await response.json();
    return data.access_token;
}

async function main() {
    if (!REFRESH_TOKEN || !CLIENT_ID || !CLIENT_SECRET) {
        console.error(
            "Missing GOOGLE_REFRESH_TOKEN, GOOGLE_CLIENT_ID, or GOOGLE_CLIENT_SECRET in .env",
        );
        return;
    }
    const accessToken = await getAccessToken(
        REFRESH_TOKEN,
        CLIENT_ID,
        CLIENT_SECRET,
    );
    // Test album creation
    const albumName = `test-${Date.now()}`;
    const album = await createAlbum(accessToken, albumName);
    console.log(album);
    // Test album listing
    const albumList = await listAlbums(accessToken);
    console.log(albumList);
    // Test image upload

    const uploadTokens = [];
    const imageNames = [];
    const count = 50;

    for (let i = 0; i < count; i++) {
        const response = await fetch(`https://dog.ceo/api/breeds/image/random`);
        const data = await response.json();
        if (!response.ok || data.status !== "success") {
            throw new Error(`Failed to fetch dog image: ${data.message}`);
        }
        const imageUri = data.message;
        const uploadToken = await uploadPhotoBytes(accessToken, imageUri);
        uploadTokens.push(uploadToken);
        imageNames.push(`Dog ${i + 1}`);
        console.log(`Uploaded image ${i + 1}/${count}`);
    }
    await createMediaItems(accessToken, album.id, uploadTokens, imageNames);
}

(async () => {
    main();
})();
