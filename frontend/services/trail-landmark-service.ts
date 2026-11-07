import bridges from "@/data/bridge_markers.json";
import mileMarkers from "@/data/mile_markers.json";
import monuments from "@/data/monument_markers.json";

export type LandmarkKind = "monument" | "bridge" | "mile-marker";
export type TrailLandmark = {
    id: string;
    kind: LandmarkKind;
    abbreviation: string;
    aliases?: string[];
    location_name: string;
    coordinates: { latitude: number; longitude: number };
    description?: string;
};
export const LANDMARK_CATEGORIES: {
    id: "all" | LandmarkKind;
    label: string;
}[] = [
    { id: "all", label: "All" },
    { id: "monument", label: "Monuments" },
    { id: "bridge", label: "Bridges" },
    { id: "mile-marker", label: "Mile markers" },
];
export const LANDMARK_LABELS: Record<LandmarkKind, string> = {
    monument: "Monument",
    bridge: "Bridge",
    "mile-marker": "Mile marker",
};
export const LANDMARK_MIN_ZOOM = 13;
export const TRAIL_LANDMARKS: TrailLandmark[] = [
    ...monuments.map((marker) => ({ ...marker, kind: "monument" as const })),
    ...bridges.map((marker) => ({ ...marker, kind: "bridge" as const })),
    ...mileMarkers.map((marker) => ({
        ...marker,
        kind: "mile-marker" as const,
    })),
];

export function searchLandmarks(
    query: string,
    category: "all" | LandmarkKind = "all",
): TrailLandmark[] {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return TRAIL_LANDMARKS.filter((marker) => {
        const text = [marker.location_name, marker.abbreviation]
            .join(" ")
            .toLowerCase();
        return (
            (category === "all" || marker.kind === category) &&
            terms.every((term) => text.includes(term))
        );
    });
}
