import { resolveTrelloIssueLocation } from "../trello-issue-location";
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
