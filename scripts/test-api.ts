import {
    createAlbum,
    createMediaItems,
    uploadPhotoBytes,
} from "@/api/googlePhotosClient";
import { listAllAlbums } from "@/services/googlePhotosAlbumsService";

const sleep = async (ms: number) => await new Promise((r) => setTimeout(r, ms));

export async function testFunctionality(
    accessToken: string,
    imageCount: number = 50,
) {
    // Test album creation
    const albumName = `test-${Date.now()}`;
    const album = await createAlbum(accessToken, albumName);
    console.log(album);
    // Test album listing
    const albumList = await listAllAlbums(accessToken);
    console.log(albumList);
    // Test image upload

    const uploadTokens = [];
    const imageNames = [];
    const urls = [];
    const count = imageCount;

    for (let i = 0; i < count; i++) {
        const response = await fetch(`https://dog.ceo/api/breeds/image/random`);
        const data = await response.json();
        if (!response.ok || data.status !== "success") {
            throw new Error(`Failed to fetch dog image: ${data.message}`);
        }
        const imageUri = data.message;
        const uploadToken = await uploadPhotoBytes(accessToken, imageUri);
        uploadTokens.push(uploadToken);
        urls.push(imageUri);
        imageNames.push(`Dog ${i + 1}`);
        console.log(`Uploaded image ${i + 1}/${count}`);
        await sleep(300);
    }
    const result = await createMediaItems(
        accessToken,
        album.id,
        uploadTokens,
        imageNames,
    );
    let idx = 0;
    for (const elm of result) {
        if (elm.status.message.includes("Failed")) {
            console.log(`Status: ${elm.status.message}`);
            console.log(`Media item ID: ${elm.mediaItem?.id}`);
            console.log(urls[idx]);
            console.log(elm.status);
        }
        idx++;
    }
}
