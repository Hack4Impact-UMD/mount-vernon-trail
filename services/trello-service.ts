// service layer between TrelloClient func and the UI
import { TrelloClient } from "./trello-funcs";
import type { TrailIssueItem } from "@/components/ui/trail-issues-card";
import type { UpcomingEventItem } from "@/components/ui/upcoming-events-card";

const BOARD_NAME = "MVT Mock Board";
const TRAIL_ISSUES_LIST = "Trail Issues and Problems - Intake";
const UPCOMING_EVENTS_LIST = "Scheduled Events";

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

    const cards = await trello.getCards(list.id, true);
    // imageUrl is set to null for now
    return Promise.all(
        cards.map(async (card) => {
            return {
                id: card.id,
                name: card.name,
                description: card.desc ?? "",
                imageUrl: null,
            };
        })
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

    const cards = await trello.getCardsFiltered(list.id, 30, false);

    return Promise.all(
        cards.map(async (card) => {
            // split date from rest of title
            const [datePart, ...rest] = card.name.split(" ");
            const [month, day, year] = datePart.split("/").map(Number);

            return {
                id: card.id,
                name: rest.join(" "),
                description: card.desc ?? "",
                // normalize 2 digit year to 4 digit (26 -> show up as 2026)
                date: new Date(2000 + (year % 100), month - 1, day),
                imageUrl: null,
            };
        })
    );
}