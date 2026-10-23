import { getListId, getTrelloClient } from "./trello-config";
import type { Card } from "./trello-types";

export type MapLocation = {
  /** GeoJSON order: longitude, latitude. */
  coordinates: [number, number];
  locationName: string;
  eventNames: string[];
};

export type MapIssueProperties = {
  cardId: string;
  name: string;
  locationName: string;
  eventNames: string[];
};

export type MapIssueFeature = {
  type: "Feature";
  id: string;
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: MapIssueProperties;
};

export type MapIssueData = {
  geojson: { type: "FeatureCollection"; features: MapIssueFeature[] };
  unlocatedIssues: { cardId: string; name: string }[];
};

/** Return null when the card cannot be located using verified source data. */
export type ResolveMapLocation = (card: Card) => MapLocation | null;

export type MapIssueFilters = {
  location?: string;
  eventName?: string;
};

function contains(value: string, query = ""): boolean {
  return value.toLowerCase().includes(query.trim().toLowerCase());
}

export function filterMapIssues(
  geojson: MapIssueData["geojson"],
  filters: MapIssueFilters,
): MapIssueData["geojson"] {
  return {
    type: "FeatureCollection",
    features: geojson.features.filter(
      ({ properties }) =>
        contains(properties.locationName, filters.location) &&
        (!filters.eventName?.trim() ||
          properties.eventNames.some((name) =>
            contains(name, filters.eventName),
          )),
    ),
  };
}

/** Fetch on map focus/refresh; Intake membership is the pin source of truth. */
export async function fetchMapIssues(
  key: string,
  resolveLocation: ResolveMapLocation,
): Promise<MapIssueData> {
  const listId = await getListId("trailIssues", key);
  const cards = await getTrelloClient(key).getCards(listId);
  const result: MapIssueData = {
    geojson: { type: "FeatureCollection", features: [] },
    unlocatedIssues: [],
  };

  for (const card of cards) {
    const location = resolveLocation(card);
    const coordinates = location?.coordinates;
    if (
      !coordinates ||
      !Number.isFinite(coordinates[0]) ||
      !Number.isFinite(coordinates[1]) ||
      Math.abs(coordinates[0]) > 180 ||
      Math.abs(coordinates[1]) > 90
    ) {
      result.unlocatedIssues.push({ cardId: card.id, name: card.name });
      continue;
    }
    result.geojson.features.push({
      type: "Feature",
      id: card.id,
      geometry: { type: "Point", coordinates: [...coordinates] },
      properties: {
        cardId: card.id,
        name: card.name,
        locationName: location!.locationName,
        eventNames: [...location!.eventNames],
      },
    });
  }
  return result;
}
