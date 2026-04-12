// service layer between TrelloClient func and the UI
import type { TrailIssueItem } from "@/components/ui/trail-issues-card";
import type { UpcomingEventItem } from "@/components/ui/upcoming-events-card";
import { TrelloClient } from "./trello-funcs";

const BOARD_NAME = "MVT Mock Board";
const TRAIL_ISSUES_LIST = "Trail Issues and Problems - Intake";
const UPCOMING_EVENTS_LIST = "Scheduled Events";

// parses trello description into structured fields
function parseEventDescription(desc: string) {
    const fields: Record<string, string> = {};
    // split on newlines, each line is a potential field
    const lines = desc.split("\n");

    for (const line of lines) {
        // strip markdown headers (###, ##, #) and match "Label: value"
        const cleaned = line.replace(/^#+\s*/, "").trim();
        const match = cleaned.match(/^([^:]+):\s*(.*)/);
        if (match) {
            const key = match[1].trim().toLowerCase().replace(/\s+/g, "");
            fields[key] = match[2].trim();
        }
    }

    return {
        eventLeader: fields["eventleader"] ?? "",
        zoneLeaders: fields["zoneleaders"] ?? "",
        toolHaulers: fields["toolhaulers"] ?? "",
        gloverLover: fields["gloverlover"] ?? "",
        workScope: fields["workscope"] ?? "",
    };
}

// fetches trail issues by most recent
// key and token are passed as parameters so auth can be swapped later
export async function fetchTrailIssues(
    key: string,
    token: string,
): Promise<TrailIssueItem[]> {
    const trello = new TrelloClient(key, token);
    // find target board and list
    const boards = await trello.getBoards();
    const board = boards.find((b) => b.name === BOARD_NAME);
    if (!board) throw new Error(`Board "${BOARD_NAME}" not found`);

    const lists = await trello.getLists(board.id);
    const list = lists.find((l) => l.name === TRAIL_ISSUES_LIST);
    if (!list) throw new Error(`List "${TRAIL_ISSUES_LIST}" not found`);

    const cards = await trello.getCards(list.id, true, true);
    return await Promise.all(
        cards.map(async (card) => {
            const imageUrl =
                card.attachments && card.attachments.length > 0
                    ? await trello.loadTrelloImage(card.attachments[0].url)
                    : null;
            return {
                id: card.id,
                name: card.name,
                description: card.desc ?? "",
                imageUrl,
            };
        }),
    );
}

// fetches upcoming event cards within the next 30 days
export async function fetchUpcomingEvents(
    key: string,
    token: string,
): Promise<UpcomingEventItem[]> {
    const trello = new TrelloClient(key, token);
    // find target board and list
    const boards = await trello.getBoards();
    const board = boards.find((b) => b.name === BOARD_NAME);
    if (!board) throw new Error(`Board "${BOARD_NAME}" not found`);

    const lists = await trello.getLists(board.id);
    const list = lists.find((l) => l.name === UPCOMING_EVENTS_LIST);
    if (!list) throw new Error(`List "${UPCOMING_EVENTS_LIST}" not found`);

    const cards = await trello.getEventCardsFiltered(list.id, 30, true, true);

    return Promise.all(
        cards.map(async (card) => {
            const imageUrl =
                card.attachments && card.attachments.length > 0
                    ? await trello.loadTrelloImage(card.attachments[0].url)
                    : null;
            const parsed = parseEventDescription(card.desc ?? "");
            return {
                id: card.id,
                name: card.name,
                description: card.desc ?? "",
                date: card.eventDate,
                imageUrl,
                ...parsed
            };
        }),
    );
}
