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
    (getTrelloClient as jest.Mock).mockReturnValue({ getCards, loadTrelloImage });
    getCards.mockResolvedValue([{ id: "issue-1", name: "Test issue" }]);
});

it("loads Intake cover attachments and preserves GeoJSON coordinate order", async () => {
    const result = await fetchMapIssues("key", () => location);
    expect(getListId).toHaveBeenCalledWith("trailIssues", "key");
    expect(getCards).toHaveBeenCalledWith("intake", false, "cover");
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
    getCards.mockResolvedValueOnce([{
        id: "issue-1", name: "Issue", attachments: [
            { mimeType: "application/pdf", url: "document" },
            { mimeType: "image/jpeg", url: "photo" },
        ],
    }]);
    loadTrelloImage.mockResolvedValueOnce("data:image/jpeg;base64,photo");
    const result = await fetchMapIssues("key", () => location);
    expect(loadTrelloImage).toHaveBeenCalledWith("photo");
    expect(result.geojson.features[0].properties.imageUrl).toBe("data:image/jpeg;base64,photo");
});

it("retains the pin when loading its photo fails", async () => {
    getCards.mockResolvedValueOnce([{
        id: "issue-1", name: "Issue", attachments: [{ mimeType: "image/jpeg", url: "photo" }],
    }]);
    loadTrelloImage.mockRejectedValueOnce(new Error("Photo unavailable"));
    const result = await fetchMapIssues("key", () => location);
    expect(result.geojson.features).toHaveLength(1);
    expect(result.geojson.features[0].properties.imageUrl).toBeNull();
});

it("does not download photos for cards without a location", async () => {
    getCards.mockResolvedValueOnce([{
        id: "issue-1", name: "Issue", attachments: [{ mimeType: "image/jpeg", url: "photo" }],
    }]);
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
