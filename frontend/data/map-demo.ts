import type { MapPin } from "@/components/map-overlays";

// Synthetic examples near the trail; these are not real issues.
const DEMO_PINS: MapPin[] = [
    {
        id: "demo-1",
        coordinates: [-77.043, 38.865],
        title: "Demo: Invasive vine removal near Mile 8",
        locationName: "Fort Hunt Park",
        status: "In Progress",
        elapsedTime: "00:16:32",
    },
    {
        id: "demo-2",
        coordinates: [-77.04, 38.805],
        title: "Demo: Clear branches from the trail",
        locationName: "Alexandria",
        status: "Not started",
    },
    {
        id: "demo-3",
        coordinates: [-77.051, 38.765],
        title: "Demo: Remove litter near the trail",
        locationName: "Mount Vernon Trail",
        status: "Completed",
    },
];

export const demoPins =
    __DEV__ && process.env.EXPO_PUBLIC_MAP_DEMO_PINS === "true"
        ? DEMO_PINS
        : [];
