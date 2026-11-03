import { TRAIL_LANDMARKS, searchLandmarks } from "../trail-landmark-service";

it("includes all supplied bridges and miles with unique IDs and valid coordinates", () => {
    expect(searchLandmarks("", [], "bridge")).toHaveLength(34);
    expect(searchLandmarks("", [], "mile-marker")).toHaveLength(8);
    expect(new Set(TRAIL_LANDMARKS.map((marker) => marker.id)).size).toBe(
        TRAIL_LANDMARKS.length,
    );
    for (const marker of TRAIL_LANDMARKS) {
        expect(marker.coordinates.latitude).toBeGreaterThan(38);
        expect(marker.coordinates.latitude).toBeLessThan(39);
        expect(marker.coordinates.longitude).toBeGreaterThan(-78);
        expect(marker.coordinates.longitude).toBeLessThan(-77);
    }
});
it("finds numbered locations, letter suffixes, and abbreviations", () => {
    expect(searchLandmarks(" b29a ", []).map((marker) => marker.id)).toEqual([
        "bridge-29a",
    ]);
    expect(
        searchLandmarks("mile marker 13", []).map((marker) => marker.id),
    ).toEqual(["mile-marker-13"]);
    expect(searchLandmarks("M4", [])[0].coordinates).toEqual({
        latitude: 38.730911,
        longitude: -77.045972,
    });
    expect(searchLandmarks("bridge 15", [])[0].coordinates).toEqual({
        latitude: 38.72585,
        longitude: -77.042314,
    });
});
it("does not infer amenities for bridges or miles and preserves monument search", () => {
    expect(searchLandmarks("", ["parking"], "bridge")).toEqual([]);
    expect(searchLandmarks("", ["water"], "mile-marker")).toEqual([]);
    expect(searchLandmarks("riverside", ["parking"], "monument")).toHaveLength(
        1,
    );
});
