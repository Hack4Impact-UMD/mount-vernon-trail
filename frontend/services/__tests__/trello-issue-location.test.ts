import {
    resolveTrelloIssueLocation,
    resolveTitleIssueLocation,
} from "../trello-issue-location";
import type { Card } from "../trello-types";

const card = (desc: string, attachments: Card["attachments"] = []): Card => ({
    id: "issue",
    name: "Intake issue",
    desc,
    attachments,
    idList: "intake",
    idBoard: "board",
    creationDate: new Date(),
});

it.each([
    "Latitude: 38.8\nLongitude: -77.05",
    "GPS: 38.8, -77.05",
    "Coordinates: 38.8, -77.05",
    "[Site](https://www.google.com/maps/search/?api=1&query=38.8%2C-77.05)",
    "https://maps.apple.com/?ll=38.8,-77.05",
    "https://openstreetmap.org/?mlat=38.8&mlon=-77.05",
])("reads explicit source coordinates: %s", (desc) => {
    expect(resolveTrelloIssueLocation(card(desc))?.coordinates).toEqual([
        -77.05, 38.8,
    ]);
});

it("reads an attached map link and preserves the location name", () => {
    expect(
        resolveTrelloIssueLocation(
            card("Location: Trail work site", [
                { url: "https://maps.google.com/?q=38.8,-77.05", mimeType: "" },
            ]),
        ),
    ).toEqual({
        coordinates: [-77.05, 38.8],
        locationName: "Trail work site",
        eventNames: [],
    });
});

it.each([
    "Clear vines at Fort Hunt Park",
    "Coordinates: 91, -77",
    "Latitude: 38.8",
    "https://www.google.com/maps/@38.8,-77.05,14z",
    "https://example.com/?q=38.8,-77.05",
    "https://www.google.com/maps/?query=Fort+Hunt+Park",
    "https://maps.app.goo.gl/short-link",
    "https://openstreetmap.org/?mlat=&mlon=",
])(
    "does not invent a location for ambiguous or invalid source data: %s",
    (desc) => {
        expect(resolveTrelloIssueLocation(card(desc))).toBeNull();
    },
);

// The reference coordinates come from the same map landmarks used by the app.
it.each(["Bridge 1 - vines", "Bridge #1: vines", "B1 vines", "[B1] vines"])(
    "matches a bridge prefix: %s",
    (name) => {
        expect(resolveTitleIssueLocation({ ...card(""), name })).toMatchObject({
            coordinates: [-77.080986, 38.716397],
            locationName: "Bridge 1",
        });
    },
);
it.each([
    "M4: repair",
    "MM 4 - repair",
    "Mile Marker 4 repair",
    "Mile 4 repair",
])("matches a mile marker prefix: %s", (name) => {
    expect(resolveTitleIssueLocation({ ...card(""), name })?.locationName).toBe(
        "Mile Marker 4",
    );
});
it("matches named landmarks", () => {
    expect(
        resolveTitleIssueLocation({
            ...card(""),
            name: "Mount Vernon Estate Trailhead - trash",
        })?.locationName,
    ).toBe("Mount Vernon Estate Trailhead");
});
it.each([
    "M4.5 repair",
    "B1000 vines",
    "Repair near Bridge 1",
    "Unknown place: trash",
])("leaves unknown or partial prefixes unresolved: %s", (name) => {
    expect(resolveTitleIssueLocation({ ...card(""), name })).toBeNull();
});

it.each([
    "Gravelly Point : John testing",
    "Gravelly Point Park : John testing",
    "gravelly point: John testing",
])("resolves the known Gravelly Point alias: %s", (name) => {
    const result = resolveTitleIssueLocation({ ...card(""), name });
    expect(result).toMatchObject({
        locationName: "Gravelly Point Park",
        coordinates: [-77.0392, 38.8647],
    });
});
it("does not treat part of an unknown place name as a known alias", () => {
    expect(
        resolveTitleIssueLocation({
            ...card(""),
            name: "Gravelly Pointer: testing",
        }),
    ).toBeNull();
});

it.each([
    ["Mount Vernon", "Mount Vernon Estate Trailhead"],
    ["Riverside Park", "Riverside Park / Little Hunting Creek"],
    ["Fort Hunt Park", "Fort Hunt Park (East Entrance)"],
    ["Dyke Marsh", "Dyke Marsh Wildlife Preserve"],
    ["Belle Haven", "Belle Haven Park & Marina"],
    ["Alexandria", "Old Town Alexandria (Oronoco Bay Park)"],
    ["Daingerfield Island", "Daingerfield Island / Washington Sailing Marina"],
    [
        "Lyndon Baines Johnson Memorial Grove",
        "Lady Bird Johnson Park / LBJ Grove",
    ],
    ["Theodore Roosevelt Island", "Theodore Roosevelt Island Trailhead"],
])("matches the reference map label %s", (prefix, expected) => {
    expect(
        resolveTitleIssueLocation({
            ...card(""),
            name: `${prefix} : Trail issue`,
        })?.locationName,
    ).toBe(expected);
});
it.each([
    "Navy-Marine Memorial: testing",
    "Fort Washington: testing",
    "Arlington Memorial Bridge: testing",
])("keeps places without reference coordinates unresolved: %s", (name) => {
    expect(resolveTitleIssueLocation({ ...card(""), name })).toBeNull();
});
