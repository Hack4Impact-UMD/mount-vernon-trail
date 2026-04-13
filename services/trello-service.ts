// service layer between TrelloClient func and the UI
import type { TrailIssueItem } from "@/components/ui/trail-issues-card";
import type { UpcomingEventItem } from "@/components/ui/upcoming-events-card";
import { TrelloClient } from "./trello-funcs";

const BOARD_NAME = "MVT Mock Board";
const TRAIL_ISSUES_LIST = "Trail Issues and Problems - Intake";
const UPCOMING_EVENTS_LIST = "Scheduled Events";
const COMPLETED_EVENTS_LIST = "Completed Events (From App)";

// fetches trail issues by most recent
// key and token are passed as parameters so auth can be swapped later
export async function fetchTrailIssues(
    key: string,
): Promise<TrailIssueItem[]> {
    const trello = new TrelloClient(key);
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
): Promise<UpcomingEventItem[]> {
    const trello = new TrelloClient(key);
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
            return {
                id: card.id,
                name: card.name,
                description: card.desc ?? "",
                date: card.eventDate,
                imageUrl,
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
): Promise<string> {
    const trello = new TrelloClient(key);
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
    if (!card.shortUrl) throw new Error("Trello did not return a card URL.");
    return { cardId: card.id, cardUrl: card.shortUrl };
}

// fetches the short URL of a trello card
export async function fetchCardUrl(
    cardId: string,
    key: string,
    token: string,
): Promise<string> {
    const trello = new TrelloClient(key, token);
    const card = await trello.getCard(cardId);
    if (!card.shortUrl) throw new Error("Trello did not return a card URL.");
    return card.shortUrl;
}

// moves a card to the Completed Events (From App) list
export async function moveCardToCompleted(
    cardId: string,
    key: string,
    token: string,
): Promise<void> {
    const trello = new TrelloClient(key, token);
    const boards = await trello.getBoards();
    const board = boards.find((b) => b.name === BOARD_NAME);
    if (!board) throw new Error(`Board "${BOARD_NAME}" not found`);

    const lists = await trello.getLists(board.id);
    const list = lists.find((l) => l.name === COMPLETED_EVENTS_LIST);
    if (!list) throw new Error(`List "${COMPLETED_EVENTS_LIST}" not found`);

    await trello.moveCardToList(cardId, list.id);
}

// adds album link to a trello event card description
export async function addAlbumLinkToCard(
    cardID: string,
    albumUrl: string,
    key: string,
): Promise<void> {
    const trello = new TrelloClient(key);
    const card = await trello.getCard(cardID);
    const currentDescription = card.desc ?? "";

    // album link pattern to detect and replace existing album links
    const albumLinkPattern = /\n\n📷 Album Link: .*/;
    const newLinkText = `\n\n📷 Album Link: ${albumUrl}`;

    let replacedDescription: string;
    if (albumLinkPattern.test(currentDescription)) {
        // replace existing album link to make operation idempotent
        replacedDescription = currentDescription.replace(
            albumLinkPattern,
            newLinkText,
        );
    } else {
        // append new album link if none exists
        replacedDescription = currentDescription + newLinkText;
    }

    await trello.replaceCardDescription(cardID, replacedDescription);
}

// Add this to trello-service.ts
export async function createTrailIssue(
    key: string,
    name: string,
    description?: string
): Promise<void> {
    const trello = new TrelloClient(key);
    
    // Find board and list
    const boards = await trello.getBoards();
    const board = boards.find((b) => b.name === BOARD_NAME);
    if (!board) throw new Error(`Board "${BOARD_NAME}" not found`);

    const lists = await trello.getLists(board.id);
    const list = lists.find((l) => l.name === TRAIL_ISSUES_LIST);
    if (!list) throw new Error(`List "${TRAIL_ISSUES_LIST}" not found`);

    // Actually create the card
    await trello.createCard(list.id, name, description);
}
