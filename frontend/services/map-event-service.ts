import { getListId, getTrelloClient } from "./trello-config";
import type { MapIssueData } from "./map-service";

export type MapEvent = { id: string; name: string; issueIds: string[] };

/** Attachment links, rather than matching titles, establish event membership. */
export async function fetchMapEvents(
    key: string,
    aliases: Record<string, string>,
): Promise<MapEvent[]> {
    const trello = getTrelloClient(key);
    const lists = await Promise.all([
        getListId("upcomingEvents", key),
        getListId("completedEvents", key),
    ]);
    // No 30-day cutoff: older demo events can still refer to current intake issues.
    const batches = await Promise.all(
        lists.map((id) => trello.getCards(id, false, true)),
    );
    const cards = [
        ...new Map(batches.flat().map((card) => [card.id, card])).values(),
    ];
    const events = await Promise.all(
        cards.map(async (card) => {
            const links = await trello.getEventCardAttachmentIDs(card);
            return {
                id: card.id,
                name: card.name,
                issueIds: [
                    ...new Set(
                        links
                            .map((link) => aliases[link])
                            .filter((id): id is string => Boolean(id)),
                    ),
                ],
            };
        }),
    );
    return events.sort((a, b) => a.name.localeCompare(b.name));
}

export function filterIssuesByEvent(
    data: MapIssueData,
    events: MapEvent[],
    selection: string,
): MapIssueData {
    if (selection === "all") return data;
    const event = events.find((item) => item.id === selection);
    // A removed event should not leave the map stuck on an invisible selection.
    if (selection !== "unassigned" && !event) return data;
    const ids = new Set(
        selection === "unassigned"
            ? events.flatMap((item) => item.issueIds)
            : event!.issueIds,
    );
    const includes = (id: string) =>
        selection === "unassigned" ? !ids.has(id) : ids.has(id);
    return {
        ...data,
        geojson: {
            ...data.geojson,
            features: data.geojson.features.filter((feature) =>
                includes(feature.properties.cardId),
            ),
        },
        unlocatedIssues: data.unlocatedIssues.filter((issue) =>
            includes(issue.cardId),
        ),
    };
}
