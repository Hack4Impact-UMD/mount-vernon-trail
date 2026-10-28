import { MONUMENTS, searchMonuments } from "../monument-service";

it("finds monument names, abbreviations, and amenity names without case sensitivity", () => {
    expect(
        searchMonuments(" tri ", []).map((marker) => marker.abbreviation),
    ).toEqual(["TRI"]);
    expect(
        searchMonuments("riverside", []).map((marker) => marker.abbreviation),
    ).toEqual(["RP"]);
    expect(
        searchMonuments("water fountain", []).every(
            (marker) => marker.amenities.water,
        ),
    ).toBe(true);
    expect(searchMonuments("", [])).toHaveLength(MONUMENTS.length);
});

it("combines text and all selected amenities", () => {
    expect(searchMonuments("riverside", ["parking", "water"])).toHaveLength(1);
    expect(searchMonuments("riverside", ["parking", "restrooms"])).toEqual([]);
    expect(
        searchMonuments("parking water", []).map((marker) => marker.id),
    ).toEqual(
        searchMonuments("", ["parking", "water"]).map((marker) => marker.id),
    );
});

it("records Alexandria's phone and restrooms and Riverside's water from the supplied legend", () => {
    const alexandria = MONUMENTS.find(
        (marker) => marker.abbreviation === "OTA",
    )!;
    expect(alexandria.amenities).toMatchObject({
        parking: false,
        phone: true,
        restrooms: true,
        water: false,
    });
    const riverside = MONUMENTS.find((marker) => marker.abbreviation === "RP")!;
    expect(riverside.amenities).toMatchObject({
        parking: true,
        phone: false,
        restrooms: false,
        water: true,
    });
});

it("returns an empty result for a nonmatching combination", () => {
    expect(searchMonuments("dyke marsh", ["parking"])).toEqual([]);
});

it("searches all eight legend amenities including combined boat launch and restaurant filters", () => {
    const matches = searchMonuments("", ["boatLaunch", "restaurants"]);
    expect(matches.map((marker) => marker.abbreviation)).toEqual(["DI"]);
    expect(
        searchMonuments("fishing", []).some(
            (marker) => marker.abbreviation === "DM",
        ),
    ).toBe(true);
    expect(searchMonuments("riverside", ["picnicking"])).toHaveLength(1);
});
