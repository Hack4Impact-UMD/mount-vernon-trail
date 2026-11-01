import { toByteArray } from "base64-js";
import { gps } from "./exif-gps";
import { getErrorMessage } from "@/utils/errors";
import type { Card } from "./trello-types";
import type { MapLocation } from "./map-service";

export type LoadIssueImage = (url: string) => Promise<string | null>;

/** Use original attachment bytes, never Trello's resized preview images. */
export async function resolvePhotoIssueLocation(
    card: Card,
    loadImage: LoadIssueImage,
): Promise<MapLocation | null> {
    for (const attachment of card.attachments ?? []) {
        if (
            !attachment.mimeType?.startsWith("image/") &&
            !/\.(?:jpe?g|heic|tiff?)(?:[?#]|$)/i.test(attachment.url)
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
            // Missing or malformed EXIF must not prevent the title fallback.
            console.warn(
                "Could not read issue photo GPS:",
                getErrorMessage(error),
            );
        }
    }
    return null;
}
