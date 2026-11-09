import type { MapPin } from "@/components/ui/map/map-overlays";

/** Keep the actual coordinates: shared landmark pins represent one location. */
export function groupMapPins(pins: MapPin[]): MapPin[][] {
    const groups = new Map<string, MapPin[]>();
    for (const pin of pins) {
        const key = `${pin.coordinates[0]},${pin.coordinates[1]}`;
        const group = groups.get(key);
        if (group) group.push(pin);
        else groups.set(key, [pin]);
    }
    return [...groups.values()];
}
