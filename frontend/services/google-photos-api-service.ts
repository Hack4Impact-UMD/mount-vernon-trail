const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
const apiKey = process.env.EXPO_PUBLIC_APP_SECRET_KEY;

// uploads before and/or after images for an issue to the event's album
export const uploadBeforeAndAfterImages = async (
    albumId: string,
    issueName: string,
    beforeImageUri: string | undefined,
    afterImageUri: string | undefined,
) => {
    const photosExist = beforeImageUri || afterImageUri;

    if (backendUrl && apiKey && albumId && photosExist) {
        try {
            const formData = new FormData();
            formData.append("albumId", albumId);
            const slug = issueName.trim().replace(/\s+/g, "-");
            if (beforeImageUri) {
                formData.append("photos", {
                    uri: beforeImageUri,
                    type: "image/jpeg",
                    name: `before-${slug}.jpg`,
                } as any);
            }
            if (afterImageUri) {
                formData.append("photos", {
                    uri: afterImageUri,
                    type: "image/jpeg",
                    name: `after-${slug}.jpg`,
                } as any);
            }
            const uploadRes = await fetch(
                `${backendUrl.replace(/\/$/, "")}/api/upload`,
                {
                    method: "POST",
                    headers: { "x-api-key": apiKey },
                    body: formData,
                },
            );
            if (!uploadRes.ok) {
                console.error("Photo upload failed:", await uploadRes.text());
            }
        } catch (uploadErr) {
            console.error("Photo upload error:", uploadErr);
        }
    }
};
