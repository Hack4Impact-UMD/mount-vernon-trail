import {
    fetchMapEvents,
    filterIssuesByEvent,
    type MapEvent,
} from "../map-event-service";
import { getListId, getTrelloClient } from "../trello-config";
import type { MapIssueData } from "../map-service";

jest.mock("../trello-config", () => ({
    getListId: jest.fn(),
    getTrelloClient: jest.fn(),
}));
const getCards = jest.fn();
const getEventCardAttachmentIDs = jest.fn();
const events: MapEvent[] = [
    { id: "event-1", name: "Cleanup", issueIds: ["one", "two"] },
    { id: "event-2", name: "Cleanup", issueIds: ["two"] },
];
const data: MapIssueData = {
    issueAliases: { one: "one", two: "two", three: "three" },
    geojson: {
        type: "FeatureCollection",
        features: ["one", "three"].map((id) => ({
            type: "Feature",
            id,
            geometry: { type: "Point", coordinates: [-77, 38] },
            properties: {
                cardId: id,
                name: id,
                eventNames: [],
                locationName: "Trail",
                imageUrl: null,
            },
        })),
    },
    unlocatedIssues: [{ cardId: "two", name: "Needs location" }],
};

beforeEach(() => {
    jest.resetAllMocks();
    jest.mocked(getListId).mockImplementation(async (slot) => slot);
    jest.mocked(getTrelloClient).mockReturnValue({
        getCards,
        getEventCardAttachmentIDs,
    } as unknown as ReturnType<typeof getTrelloClient>);
});

it("joins short links and full IDs, deduplicates events, and ignores issues outside Intake", async () => {
    getCards.mockImplementation(async (list) =>
        list === "upcomingEvents"
            ? [{ id: "event-1", name: "Old cleanup" }]
            : [
                  { id: "event-1", name: "Old cleanup" },
                  { id: "event-2", name: "Another cleanup" },
              ],
    );
    getEventCardAttachmentIDs.mockImplementation(async (card) =>
        card.id === "event-1" ? ["shortOne", "two", "two", "outside"] : [],
    );
    const result = await fetchMapEvents("key", { shortOne: "one", two: "two" });
    expect(getCards).toHaveBeenCalledWith("upcomingEvents", false, true);
    expect(getCards).toHaveBeenCalledWith("completedEvents", false, true);
    expect(result).toEqual([
        { id: "event-2", name: "Another cleanup", issueIds: [] },
        { id: "event-1", name: "Old cleanup", issueIds: ["one", "two"] },
    ]);
});

it("filters by event ID even when titles are identical and keeps unlocated cards accounted for", () => {
    const filtered = filterIssuesByEvent(data, events, "event-1");
    expect(filtered.geojson.features.map((feature) => feature.id)).toEqual([
        "one",
    ]);
    expect(filtered.unlocatedIssues).toEqual(data.unlocatedIssues);
    expect(
        filterIssuesByEvent(data, events, "event-2").geojson.features,
    ).toEqual([]);
    expect(data.geojson.features).toHaveLength(2);
});

it("shows only issues outside every event for Unassigned", () => {
    const filtered = filterIssuesByEvent(data, events, "unassigned");
    expect(filtered.geojson.features.map((feature) => feature.id)).toEqual([
        "three",
    ]);
    expect(filtered.unlocatedIssues).toEqual([]);
});

it("restores all issues for All or a removed event", () => {
    expect(filterIssuesByEvent(data, events, "all")).toBe(data);
    expect(filterIssuesByEvent(data, events, "removed")).toBe(data);
});

it("propagates event fetch failures so the UI does not label everything Unassigned", async () => {
    getCards.mockRejectedValue(new Error("Trello unavailable"));
    await expect(fetchMapEvents("key", {})).rejects.toThrow(
        "Trello unavailable",
    );
});
