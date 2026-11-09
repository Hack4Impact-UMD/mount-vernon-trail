import monuments from "@/data/monument_markers.json";

export type MonumentMarker = (typeof monuments)[number];
export type MonumentAmenity =
    | "parking"
    | "phone"
    | "restrooms"
    | "water"
    | "boatLaunch"
    | "fishing"
    | "picnicking"
    | "restaurants";
export const MONUMENT_AMENITIES: { id: MonumentAmenity; label: string }[] = [
    { id: "parking", label: "Parking" },
    { id: "phone", label: "Phone" },
    { id: "restrooms", label: "Restrooms" },
    { id: "water", label: "Water Fountain" },
    { id: "boatLaunch", label: "Boat Launch" },
    { id: "fishing", label: "Fishing" },
    { id: "picnicking", label: "Picnicking" },
    { id: "restaurants", label: "Restaurants" },
];
export const MONUMENTS = monuments;

/** Amenity flags mean shown on the reference map, not verified current facilities. */
export function searchMonuments(
    query: string,
    amenities: MonumentAmenity[],
): MonumentMarker[] {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return monuments.filter((marker) => {
        const labels = MONUMENT_AMENITIES.filter(
            (item) => marker.amenities[item.id],
        ).map((item) => item.label);
        const text = [marker.location_name, marker.abbreviation, ...labels]
            .join(" ")
            .toLowerCase();
        return (
            terms.every((term) => text.includes(term)) &&
            amenities.every((amenity) => marker.amenities[amenity])
        );
    });
}
