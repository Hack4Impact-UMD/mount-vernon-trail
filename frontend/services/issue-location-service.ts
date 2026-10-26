import { db } from "@/config/firebase";
import { ISSUE_LOCATIONS_COLLECTION } from "@/types/issue-location";
import { doc, getDoc } from "firebase/firestore";
import { requireUser } from "./require-user";
import type { MapLocation } from "./map-service";
import type { Card } from "./trello-types";

/** Read by issue card ID, never by event ID. Missing documents are unresolved. */
export async function resolveFirestoreIssueLocation(
    card: Card,
): Promise<MapLocation | null> {
    requireUser("view issue locations");
    const snapshot = await getDoc(doc(db, ISSUE_LOCATIONS_COLLECTION, card.id));
    const location = snapshot.data()?.location;
    if (
        !location ||
        typeof location.locationName !== "string" ||
        !location.locationName.trim() ||
        typeof location.latitude !== "number" ||
        typeof location.longitude !== "number" ||
        !Number.isFinite(location.latitude) ||
        !Number.isFinite(location.longitude) ||
        Math.abs(location.latitude) > 90 ||
        Math.abs(location.longitude) > 180
    )
        return null;
    return {
        coordinates: [location.longitude, location.latitude],
        locationName: location.locationName,
        eventNames: [],
    };
}
