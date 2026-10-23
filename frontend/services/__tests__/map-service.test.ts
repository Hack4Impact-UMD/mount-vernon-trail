import {
  fetchMapIssues,
  filterMapIssues,
  type MapLocation,
} from "../map-service";
import { getListId, getTrelloClient } from "../trello-config";

jest.mock("../trello-config", () => ({
  getListId: jest.fn(),
  getTrelloClient: jest.fn(),
}));

const getCards = jest.fn();
const location: MapLocation = {
  coordinates: [-77.05, 38.8],
  locationName: "Test area",
  eventNames: ["Test cleanup"],
};

beforeEach(() => {
  jest.clearAllMocks();
  (getListId as jest.Mock).mockResolvedValue("intake");
  (getTrelloClient as jest.Mock).mockReturnValue({ getCards });
  getCards.mockResolvedValue([{ id: "issue-1", name: "Test issue" }]);
});

it("loads Intake without attachments and preserves GeoJSON coordinate order", async () => {
  const result = await fetchMapIssues("key", () => location);
  expect(getListId).toHaveBeenCalledWith("trailIssues", "key");
  expect(getCards).toHaveBeenCalledWith("intake");
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

it("propagates Trello failures instead of returning a misleading empty map", async () => {
  getCards.mockRejectedValueOnce(new Error("Network unavailable"));
  await expect(fetchMapIssues("key", () => location)).rejects.toThrow(
    "Network unavailable",
  );
});

it("combines case-insensitive location and event filters without changing the source", async () => {
  const { geojson } = await fetchMapIssues("key", () => location);
  expect(
    filterMapIssues(geojson, { location: " AREA ", eventName: "CLEANUP" })
      .features,
  ).toHaveLength(1);
  expect(filterMapIssues(geojson, { eventName: "other" }).features).toEqual([]);
  expect(filterMapIssues(geojson, {}).features).toHaveLength(1);
  expect(geojson.features).toHaveLength(1);
});
