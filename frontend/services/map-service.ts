import { getListId, getTrelloClient } from "./trello-config";
import type { Card } from "./trello-types";
import { resolveFirestoreIssueLocation } from "./issue-location-service";
import { resolveTrelloIssueLocation } from "./trello-issue-location";

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
    imageUrl: string | null;
};

export type MapIssueFeature = {
    type: "Feature";
    id: string;
    geometry: { type: "Point"; coordinates: [number, number] };
    properties: MapIssueProperties;
};

export type MapIssueData = {
    geojson: { type: "FeatureCollection"; features: MapIssueFeature[] };
    issueAliases: Record<string, string>;
    unlocatedIssues: { cardId: string; name: string }[];
};

/** Return null when the card cannot be located using verified source data. */
export type ResolveMapLocation = (
    card: Card,
) => MapLocation | null | Promise<MapLocation | null>;

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

async function resolveIssueLocation(card: Card): Promise<MapLocation | null> {
    const saved = await resolveFirestoreIssueLocation(card);
    return saved ?? resolveTrelloIssueLocation(card);
}

/** Fetch on map focus/refresh; Intake membership is the pin source of truth. */
export async function fetchMapIssues(
    key: string,
    resolveLocation: ResolveMapLocation = resolveIssueLocation,
): Promise<MapIssueData> {
    const listId = await getListId("trailIssues", key);
    const trello = getTrelloClient(key);
    const cards = await trello.getCards(listId, false, true);
    const result: MapIssueData = {
        geojson: { type: "FeatureCollection", features: [] },
        unlocatedIssues: [],
        issueAliases: {},
    };

    for (const card of cards) {
        result.issueAliases[card.id] = card.id;
        if (card.shortUrl) {
            try {
                const url = new URL(card.shortUrl);
                const link = /^\/c\/([a-zA-Z0-9]+)(?:\/|$)/.exec(url.pathname);
                if (url.hostname === "trello.com" && link)
                    result.issueAliases[link[1]] = card.id;
            } catch {
                // A malformed short URL does not invalidate the issue itself.
            }
        }
    }

    const locations = await Promise.all(
        cards.map((card) => resolveLocation(card)),
    );
    for (const [index, card] of cards.entries()) {
        const location = locations[index];
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
        const image = card.attachments?.find((attachment) =>
            attachment.mimeType?.startsWith("image/"),
        );
        // A failed photo must not hide an otherwise valid issue pin.
        const imageUrl = image
            ? await trello.loadTrelloImage(image.url).catch(() => null)
            : null;
        result.geojson.features.push({
            type: "Feature",
            id: card.id,
            geometry: { type: "Point", coordinates: [...coordinates] },
            properties: {
                cardId: card.id,
                name: card.name,
                locationName: location!.locationName,
                eventNames: [...location!.eventNames],
                imageUrl,
            },
        });
    }
    return result;
}
