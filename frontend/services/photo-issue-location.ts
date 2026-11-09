import { toByteArray } from "base64-js";
import { gps } from "./exif-gps";
import { getErrorMessage } from "@/utils/errors";
import type { Card } from "./trello-types";
import type { MapLocation } from "./map-service";

const GPS_IMAGE_TYPES = new Set([
    "image/jpeg",
    "image/jpg",
    "image/tiff",
    "image/heic",
    "image/heif",
    "image/avif",
]);
const GPS_IMAGE_EXTENSION = /\.(?:jpe?g|heic|heif|avif|tiff?)(?:[?#]|$)/i;

export type LoadIssueImage = (url: string) => Promise<string | null>;

/** Use original attachment bytes, never Trello's resized preview images. */
export async function resolvePhotoIssueLocation(
    card: Card,
    loadImage: LoadIssueImage,
): Promise<MapLocation | null> {
    for (const attachment of card.attachments ?? []) {
        const mimeType = attachment.mimeType
            ?.split(";")[0]
            .trim()
            .toLowerCase();
        // A known PNG/WebP/GIF cannot be read by our registered EXIF parsers.
        if (mimeType?.startsWith("image/") && !GPS_IMAGE_TYPES.has(mimeType))
            continue;
        if (
            !GPS_IMAGE_TYPES.has(mimeType) &&
            !GPS_IMAGE_EXTENSION.test(attachment.url)
        )
            continue;
        try {
            const image = await loadImage(attachment.url);
            if (!image) continue;
            // The mobile-safe EXIF bundle accepts bytes, without Node's Buffer.
            const base64 = image.replace(/^data:[^,]*;base64,/, "");
            const location = await gps(toByteArray(base64));
            if (
                !location ||
                !Number.isFinite(location.latitude) ||
                !Number.isFinite(location.longitude) ||
                Math.abs(location.latitude) > 90 ||
                Math.abs(location.longitude) > 180
            )
                continue;
            return {
                coordinates: [location.longitude, location.latitude],
                locationName: card.name,
                eventNames: [],
            };
        } catch (error: unknown) {
            // Some attachments have misleading extensions/MIME types. Unsupported
            // bytes are an expected fallback, rather than a warning on every refresh.
            if (getErrorMessage(error) === "Unknown file format") continue;
            console.warn(
                "Could not read issue photo GPS:",
                getErrorMessage(error),
            );
        }
    }
    return null;
}
