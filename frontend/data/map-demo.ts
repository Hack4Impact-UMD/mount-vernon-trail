import type { MapPin } from "@/components/map-overlays";

// Synthetic examples near the trail; these are not real issues.
const DEMO_PINS: MapPin[] = [
    { id: "demo-1", coordinates: [-77.043, 38.865] },
    { id: "demo-2", coordinates: [-77.04, 38.805] },
    { id: "demo-3", coordinates: [-77.051, 38.765] },
];

export const demoPins =
    __DEV__ && process.env.EXPO_PUBLIC_MAP_DEMO_PINS === "true"
        ? DEMO_PINS
        : [];