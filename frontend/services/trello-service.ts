// service layer between TrelloClient func and the UI
import type { UpcomingEventItem } from "@/components/ui/upcoming-events-card";
import type {
    TrailDocumentIssueItem,
    TrailIssueItem,
} from "@/types/trail-types";
import { getListId, getTrelloClient } from "./trello-config";
import { EventCard, TrelloAttachment } from "./trello-types";

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
export async function fetchTrailIssues(key: string): Promise<TrailIssueItem[]> {
    const trello = getTrelloClient(key);
    const listId = await getListId("trailIssues", key);
    const cards = await trello.getCards(listId, true, "cover");
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

// fetches trail issues by most recent
// key and token are passed as parameters so auth can be swapped later
export async function fetchDocumentTrailIssues(
    key: string,
    eventCard: EventCard,
): Promise<TrailDocumentIssueItem[]> {
    const trello = getTrelloClient(key);
    const attachmentIDs = await trello.getEventCardAttachmentIDs(eventCard);
    return await Promise.all(
        attachmentIDs.map(async (id) => {
            // get issue card by ID
            const card = await trello.getCardByID(id, "cover");
            // get cover image (if it exists) associated with issue card
            // that is an attachment to the event card
            const imageUrl =
                card.attachments && card.attachments.length > 0
                    ? await trello.loadTrelloImage(card.attachments[0].url)
                    : null;
            return {
                id: card.id,
                name: card.name,
                description: card.desc ?? "",
                creationDate: card.creationDate,
                imageUrl,
            };
        }),
    );
}

// fetches event cards within 30 days of today: either the upcoming ones still
// scheduled, or the already published ones sitting in Completed Events
export async function fetchEventCards(
    key: string,
    filter: "upcoming" | "past",
): Promise<UpcomingEventItem[]> {
    const trello = getTrelloClient(key);
    const listId = await getListId(
        filter === "past" ? "completedEvents" : "upcomingEvents",
        key,
    );
    const cards = await trello.getEventCardsFiltered(
        listId,
        filter,
        30,
        true,
        true,
    );
    return Promise.all(
        cards.map(async (card) => {
            const imgAttachmentUrl = getFirstImageAttachment(card.attachments);
            const imageUrl = imgAttachmentUrl
                ? await trello.loadTrelloImage(imgAttachmentUrl)
                : null;
            const parsed = parseEventDescription(card.desc ?? "");
            return {
                id: card.id,
                name: card.name,
                description: card.desc ?? "",
                date: card.eventDate,
                imageUrl,
                ...parsed,
            };
        }),
    );
}

// finds the first image (not trello card or other) attached to a card to display with it
function getFirstImageAttachment(
    attachments: TrelloAttachment[] | undefined,
): string | null {
    if (!attachments || attachments.length === 0) return null;

    const pattern = /image/;
    const img = attachments.find((attachment) =>
        pattern.exec(attachment.mimeType),
    );
    return img?.url ?? null;
}

// creates a new event card in the Scheduled Events list with the card name prefixed with date
export async function createEventCard(
    title: string,
    dateStr: string,
    description: string,
    key: string,
): Promise<{ cardId: string; cardUrl: string }> {
    const trello = getTrelloClient(key);
    const listId = await getListId("upcomingEvents", key);
    const card = await trello.createCard(
        listId,
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
): Promise<string> {
    const trello = getTrelloClient(key);
    const card = await trello.getCard(cardId);
    if (!card.shortUrl) throw new Error("Trello did not return a card URL.");
    return card.shortUrl;
}

// moves a card to the Completed Events (From App) list
export async function moveCardToCompleted(
    cardId: string,
    key: string,
): Promise<void> {
    const trello = getTrelloClient(key);
    const listId = await getListId("completedEvents", key);
    await trello.moveCardToList(cardId, listId);
}

// Compensation for a failed event setup. An event card may already be visible
// to the team, so archiving is the safer undo than a hard delete.
export async function archiveCard(cardId: string, key: string): Promise<void> {
    await getTrelloClient(key).archiveCard(cardId);
}

// moves all attachments from a card to completed issues list
export async function moveCardAttachmentsToCompleted(
    cardId: string,
    key: string,
): Promise<void> {
    const trello = getTrelloClient(key);
    const listId = await getListId("completedIssues", key);

    // get all attachments on the card
    const eventCard = await trello.getEventCardByID(cardId, true);
    const attachments = await trello.getEventCardAttachmentIDs(eventCard);

    // move each attachment (issue card) to completed issues list
    const results = await Promise.allSettled(
        attachments.map((attachmentId) =>
            trello.moveCardToList(attachmentId, listId),
        ),
    );
    const failedAttachments = results
        .map((result, index) =>
            result.status === "rejected" ? attachments[index] : null,
        )
        .filter((id) => id !== null);
    if (failedAttachments.length > 0) {
        throw new Error(
            `Failed to move ${failedAttachments.length} attachment${failedAttachments.length === 1 ? "" : "s"}: ${failedAttachments.join(", ")}`,
        );
    }
}

// Field notes live in a marked section of the issue card's description so they
// can be rewritten without destroying the original issue text.
const FIELD_NOTES_PATTERN = /\n\n📝 Field Notes:\n[\s\S]*$/;

export function extractIssueNotes(description: string): string {
    const match = FIELD_NOTES_PATTERN.exec(description);
    return match ? match[0].replace("\n\n📝 Field Notes:\n", "") : "";
}

export async function saveIssueNotes(
    cardId: string,
    notes: string,
    key: string,
): Promise<void> {
    const trello = getTrelloClient(key);
    const card = await trello.getCard(cardId);
    const current = card.desc ?? "";
    const base = current.replace(FIELD_NOTES_PATTERN, "");
    const trimmed = notes.trim();
    const next = trimmed ? `${base}\n\n📝 Field Notes:\n${trimmed}` : base;
    if (next === current) return;
    await trello.replaceCardDescription(cardId, next);
}

// Creates a trail issue and links it to the event card, which is how
// fetchDocumentTrailIssues discovers the issues belonging to an event.
export async function createTrailIssue(
    eventCardId: string,
    name: string,
    description: string,
    key: string,
): Promise<{ cardId: string; cardUrl: string }> {
    const trello = getTrelloClient(key);
    const listId = await getListId("trailIssues", key);
    const card = await trello.createCard(listId, name, description);

    try {
        if (!card.shortUrl) throw new Error("Trello did not return a card URL.");
        await trello.addAttachmentToCard(eventCardId, card.shortUrl);
        return { cardId: card.id, cardUrl: card.shortUrl };
    } catch (attachErr) {
        // compensate: delete the orphaned card so a retry won't create duplicates
        try {
            await trello.deleteCard(card.id);
        } catch (deleteErr) {
            console.error(
                "Failed to clean up orphaned issue card:",
                card.id,
                deleteErr,
            );
        }
        throw attachErr;
    }
}

// The Notes/Metrics layout the issue screen writes into a card description.
function buildIssueDescription(notes: string, metrics: string): string {
    return [
        notes.trim() ? `Notes:\n${notes.trim()}` : "",
        metrics.trim() ? `Metrics:\n${metrics.trim()}` : "",
    ]
        .filter(Boolean)
        .join("\n\n");
}

// creates a new issue card in the Trail Issues list and attaches it to the event card
// Delegates to createTrailIssue so the orphan rollback lives in exactly one place.
export async function createIssueCard(
    name: string,
    notes: string,
    metrics: string,
    eventTrelloCardId: string,
    key: string,
): Promise<string> {
    const { cardId } = await createTrailIssue(
        eventTrelloCardId,
        name,
        buildIssueDescription(notes, metrics),
        key,
    );
    return cardId;
}

// updates the notes and metrics on an existing issue card
// Note: this rewrites the whole description, whereas saveIssueNotes only
// rewrites the "📝 Field Notes" section. A card edited through both paths keeps
// both blocks; pick one path per screen.
export async function updateIssueCard(
    issueCardId: string,
    name: string,
    key: string,
    notes?: string,
    metrics?: string,
): Promise<void> {
    const fields: { name: string; desc?: string } = { name: name.trim() };
    if (notes !== undefined || metrics !== undefined) {
        fields.desc = buildIssueDescription(notes ?? "", metrics ?? "");
    }
    await getTrelloClient(key).updateCard(issueCardId, fields);
}

// adds album link to a trello event card description
export async function addAlbumLinkToCard(
    cardID: string,
    albumUrl: string,
    key: string,
): Promise<void> {
    const trello = getTrelloClient(key);
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

// adds notes to a trello event card description
export async function addNotesToCard(
    cardID: string,
    notes: string,
    key: string,
): Promise<void> {
    const trello = getTrelloClient(key);
    const card = await trello.getCard(cardID);
    const currentDescription = card.desc ?? "";

    const notesPattern = /\n\n📝 Notes:.*?(?=\n\n📷 Album Link:|$)/s;
    const trimmedNotes = notes.trim();
    const newNotesText = `\n\n📝 Notes:\n${trimmedNotes}`;

    let replacedDescription: string;
    if (
        currentDescription.includes("📷 Album Link:") &&
        notesPattern.test(currentDescription)
    ) {
        // replace existing notes to make operation idempotent
        // note: this makes the assumption that notes are followed by the album link
        replacedDescription = currentDescription.replace(
            notesPattern,
            newNotesText,
        );
    } else {
        // append new notes if none exists or if notes exist but there is no album link (position is unknown so just append to end)
        replacedDescription = currentDescription + newNotesText;
    }
    await trello.replaceCardDescription(cardID, replacedDescription);
}
