import {
    fetchMapIssues,
    filterMapIssues,
    type MapLocation,
} from "../map-service";
import { getListId, getTrelloClient } from "../trello-config";
import { resolveFirestoreIssueLocation } from "../issue-location-service";

jest.mock("../issue-location-service", () => ({
    resolveFirestoreIssueLocation: jest.fn(),
}));

jest.mock("../trello-config", () => ({
    getListId: jest.fn(),
    getTrelloClient: jest.fn(),
}));

const getCards = jest.fn();
const loadTrelloImage = jest.fn();
const location: MapLocation = {
    coordinates: [-77.05, 38.8],
    locationName: "Test area",
    eventNames: ["Test cleanup"],
};

beforeEach(() => {
    jest.clearAllMocks();
    (getListId as jest.Mock).mockResolvedValue("intake");
    (getTrelloClient as jest.Mock).mockReturnValue({
        getCards,
        loadTrelloImage,
    });
    getCards.mockResolvedValue([{ id: "issue-1", name: "Test issue" }]);
});

it("loads all Intake attachments and preserves GeoJSON coordinate order", async () => {
    const result = await fetchMapIssues("key", () => location);
    expect(getListId).toHaveBeenCalledWith("trailIssues", "key");
    expect(getCards).toHaveBeenCalledWith("intake", false, true);
    expect(result.geojson.features[0]).toMatchObject({
        id: "issue-1",
        geometry: { type: "Point", coordinates: [-77.05, 38.8] },
        properties: { cardId: "issue-1", eventNames: ["Test cleanup"] },
    });
    expect(result.unlocatedIssues).toEqual([]);
});

it.each([null, [NaN, 38], [-77, Infinity], [181, 38], [-77, -91]])(
    "reports missing or invalid coordinates (%s) without placing a pin",
    async (coordinates) => {
        const result = await fetchMapIssues("key", () =>
            coordinates === null
                ? null
                : { ...location, coordinates: coordinates as [number, number] },
        );
        expect(result.geojson.features).toEqual([]);
        expect(result.unlocatedIssues).toEqual([
            { cardId: "issue-1", name: "Test issue" },
        ]);
    },
);

it("reflects a card moving out of Intake on the next fetch", async () => {
    expect(
        (await fetchMapIssues("key", () => location)).geojson.features,
    ).toHaveLength(1);
    getCards.mockResolvedValueOnce([]);
    expect(
        (await fetchMapIssues("key", () => location)).geojson.features,
    ).toEqual([]);
});

it("uses saved Firestore locations by default, only for current Intake cards", async () => {
    (resolveFirestoreIssueLocation as jest.Mock).mockResolvedValue(location);
    const result = await fetchMapIssues("key");
    expect(resolveFirestoreIssueLocation).toHaveBeenCalledWith(
        expect.objectContaining({ id: "issue-1" }),
    );
    expect(result.geojson.features[0].geometry.coordinates).toEqual([
        -77.05, 38.8,
    ]);
    (resolveFirestoreIssueLocation as jest.Mock).mockClear();
    getCards.mockResolvedValueOnce([]);
    expect((await fetchMapIssues("key")).geojson.features).toEqual([]);
    expect(resolveFirestoreIssueLocation).not.toHaveBeenCalled();
});

it("propagates Firestore failures rather than reporting an empty map", async () => {
    (resolveFirestoreIssueLocation as jest.Mock).mockRejectedValueOnce(
        new Error("Permission denied"),
    );
    await expect(fetchMapIssues("key")).rejects.toThrow("Permission denied");
});

it("propagates Trello failures instead of returning a misleading empty map", async () => {
    getCards.mockRejectedValueOnce(new Error("Network unavailable"));
    await expect(fetchMapIssues("key", () => location)).rejects.toThrow(
        "Network unavailable",
    );
});

it("loads an image attachment for the popup, skipping non-image attachments", async () => {
    getCards.mockResolvedValueOnce([
        {
            id: "issue-1",
            name: "Issue",
            attachments: [
                { mimeType: "application/pdf", url: "document" },
                { mimeType: "image/jpeg", url: "photo" },
            ],
        },
    ]);
    loadTrelloImage.mockResolvedValueOnce("data:image/jpeg;base64,photo");
    const result = await fetchMapIssues("key", () => location);
    expect(loadTrelloImage).toHaveBeenCalledWith("photo");
    expect(result.geojson.features[0].properties.imageUrl).toBe(
        "data:image/jpeg;base64,photo",
    );
});

it("retains the pin when loading its photo fails", async () => {
    getCards.mockResolvedValueOnce([
        {
            id: "issue-1",
            name: "Issue",
            attachments: [{ mimeType: "image/jpeg", url: "photo" }],
        },
    ]);
    loadTrelloImage.mockRejectedValueOnce(new Error("Photo unavailable"));
    const result = await fetchMapIssues("key", () => location);
    expect(result.geojson.features).toHaveLength(1);
    expect(result.geojson.features[0].properties.imageUrl).toBeNull();
});

it("does not download photos for cards without a location", async () => {
    getCards.mockResolvedValueOnce([
        {
            id: "issue-1",
            name: "Issue",
            attachments: [{ mimeType: "image/jpeg", url: "photo" }],
        },
    ]);
    await fetchMapIssues("key", () => null);
    expect(loadTrelloImage).not.toHaveBeenCalled();
});

it("combines case-insensitive location and event filters without changing the source", async () => {
    const { geojson } = await fetchMapIssues("key", () => location);
    expect(
        filterMapIssues(geojson, { location: " AREA ", eventName: "CLEANUP" })
            .features,
    ).toHaveLength(1);
    expect(filterMapIssues(geojson, { eventName: "other" }).features).toEqual(
        [],
    );
    expect(filterMapIssues(geojson, {}).features).toHaveLength(1);
    expect(geojson.features).toHaveLength(1);
});

it("places a source-coordinate card when there is no saved Firestore location", async () => {
    (resolveFirestoreIssueLocation as jest.Mock).mockResolvedValue(null);
    getCards.mockResolvedValueOnce([
        {
            id: "issue-1",
            name: "Source issue",
            desc: "Latitude: 38.8\nLongitude: -77.05",
        },
    ]);
    const result = await fetchMapIssues("key");
    expect(result.geojson.features[0].geometry.coordinates).toEqual([
        -77.05, 38.8,
    ]);
    expect(result.unlocatedIssues).toEqual([]);
});

it("keeps every Intake card accounted for without adding synthetic pins", async () => {
    (resolveFirestoreIssueLocation as jest.Mock).mockResolvedValue(null);
    getCards.mockResolvedValueOnce([
        { id: "located-1", name: "Coordinate card", desc: "GPS: 38.8, -77.05" },
        {
            id: "located-2",
            name: "Map link card",
            attachments: [
                {
                    url: "https://maps.google.com/?q=38.81,-77.06",
                    mimeType: "",
                },
            ],
        },
        { id: "unlocated", name: "Needs coordinates" },
    ]);
    const result = await fetchMapIssues("key");
    expect(result.geojson.features.map((feature) => feature.id)).toEqual([
        "located-1",
        "located-2",
    ]);
    expect(result.unlocatedIssues).toEqual([
        { cardId: "unlocated", name: "Needs coordinates" },
    ]);
});

it("prefers a saved location over coordinates in the card description", async () => {
    (resolveFirestoreIssueLocation as jest.Mock).mockResolvedValue(location);
    getCards.mockResolvedValueOnce([
        { id: "issue-1", name: "Issue", desc: "GPS: 38.9, -77.1" },
    ]);
    const result = await fetchMapIssues("key");
    expect(result.geojson.features[0].geometry.coordinates).toEqual(
        location.coordinates,
    );
});

it("records full IDs and short links for located and unlocated Intake cards", async () => {
    getCards.mockResolvedValueOnce([
        {
            id: "one",
            name: "Located",
            shortUrl: "https://trello.com/c/ShortOne/name",
        },
        {
            id: "two",
            name: "Unlocated",
            shortUrl: "https://trello.com/c/ShortTwo",
        },
    ]);
    const result = await fetchMapIssues("key", (card) =>
        card.id === "one" ? location : null,
    );
    expect(result.issueAliases).toEqual({
        one: "one",
        two: "two",
        ShortOne: "one",
        ShortTwo: "two",
    });
});
