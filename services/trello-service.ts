// service layer between TrelloClient func and the UI
import type { TrailIssueItem } from "@/components/ui/trail-issues-card";
import type { UpcomingEventItem } from "@/components/ui/upcoming-events-card";
import { TrelloClient } from "./trello-funcs";

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

    const cards = await trello.getEventCardsFiltered(list.id, 30, true);

    return Promise.all(
        cards.map(async (card) => {
            return {
                id: card.id,
                name: card.name,
                description: card.desc ?? "",
                date: card.eventDate,
                imageUrl: null,
            };
        }),
    );
}

// creates a new event card in the Scheduled Events list with the card name prefixed with date
export async function createEventCard(
    title: string,
    dateStr: string,
    description: string,
    key: string,
    token: string,
): Promise<string> {
    const trello = new TrelloClient(key, token);
    const boards = await trello.getBoards();
    const board = boards.find((b) => b.name === BOARD_NAME);
    if (!board) throw new Error(`Board "${BOARD_NAME}" not found`);

    const lists = await trello.getLists(board.id);
    const list = lists.find((l) => l.name === UPCOMING_EVENTS_LIST);
    if (!list) throw new Error(`List "${UPCOMING_EVENTS_LIST}" not found`);

    const card = await trello.createCard(
        list.id,
        `${dateStr} ${title}`,
        description,
    );
    return card.id;
}

// adds album link to a trello event card description
export async function addAlbumLinkToCard(
    cardID: string,
    albumUrl: string,
    key: string,
    token: string,
): Promise<void> {
    const trello = new TrelloClient(key, token);
    const card = await trello.getCard(cardID);
    const currentDescription = card.desc ?? "";

    // append album link to description
    const linkText = `\n\n📷 Album Link: ${albumUrl}`;
    const updatedDescription = currentDescription + linkText;

    await trello.updateCardDescription(cardID, updatedDescription);
}
