import { groupMapPins } from "../map-pins";
import type { MapPin } from "@/components/ui/map/map-overlays";

it("groups shared coordinates while keeping every issue and its details", () => {
    const pins: MapPin[] = [
        { id: "one", coordinates: [-77, 38], title: "First issue" },
        { id: "other", coordinates: [-77, 39], title: "Other location" },
        { id: "two", coordinates: [-77, 38], title: "Second issue" },
    ];
    expect(groupMapPins(pins)).toEqual([[pins[0], pins[2]], [pins[1]]]);
    expect(pins.map((pin) => pin.id)).toEqual(["one", "other", "two"]);
});
it("keeps distinct nearby coordinates separate, even with identical location names", () => {
    expect(
        groupMapPins([
            { id: "one", coordinates: [-77, 38], locationName: "Park" },
            { id: "two", coordinates: [-77, 38.00001], locationName: "Park" },
        ]),
    ).toHaveLength(2);
});
it("handles an empty map", () => expect(groupMapPins([])).toEqual([]));
