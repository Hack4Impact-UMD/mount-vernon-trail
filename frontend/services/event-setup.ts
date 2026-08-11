import { createAlbum, getAlbum } from "@/api/backend-client";
import { getDateString } from "@/utils/date";
import { getErrorMessage } from "@/utils/errors";
import {
    finalizeAlbum,
    markAlbumCreated,
    releaseAlbumTitle,
    reserveAlbumTitle,
} from "./album-service";
import { createEvent } from "./event-service";
import { addAlbumLinkToCard, archiveCard, createEventCard } from "./trello-service";

export type EventSetupInput = {
    title: string;
    description: string;
    eventDate: Date;
    eventLeader: string;
    zoneLeaders: string;
    toolHaulers: string;
    gloverLover: string;
    notes: string;
};

export type EventSetupResult = {
    eventId: string;
    cardId: string;
    cardUrl: string;
    albumId: string;
    albumUrl: string;
};

// Carries what could not be rolled back, so a partial failure is never silent.
export class EventSetupError extends Error {
    readonly residue: string[];

    constructor(message: string, residue: string[]) {
        super(
            residue.length === 0
                ? message
                : `${message} Manual cleanup needed: ${residue.join("; ")}`,
        );
        this.name = "EventSetupError";
        this.residue = residue;
    }
}

// Creating an event touches three systems. Previously a failure partway left
// orphans behind and a retry duplicated them — worse, the orphaned album record
// permanently blocked ever reusing that title. Each step now registers its undo.
export async function setupEvent(
    input: EventSetupInput,
    trelloKey: string,
): Promise<EventSetupResult> {
    const title = input.title.trim();
    const undos: (() => Promise<void>)[] = [];

    async function unwind(): Promise<string[]> {
        const residue: string[] = [];
        for (const undo of [...undos].reverse()) {
            try {
                await undo();
            } catch (error) {
                residue.push(getErrorMessage(error));
            }
        }
        return residue;
    }

    try {
        // Claim the title first: a collision then costs zero external calls.
        const reservation = await reserveAlbumTitle(title);
        undos.push(() => releaseAlbumTitle(reservation.titleKey));

        // Google Photos has no album-delete endpoint, so a retry reuses the
        // album from an earlier failed attempt rather than creating a second.
        const album = reservation.existingAlbumId
            ? await getAlbum(reservation.existingAlbumId)
            : await createAlbum(title);
        const albumUrl = album.productUrl ?? "";

        if (!reservation.existingAlbumId) {
            await markAlbumCreated(reservation.titleKey, album.id);
        }

        // Must precede createEvent, whose batch updates this album document.
        await finalizeAlbum({
            titleKey: reservation.titleKey,
            albumId: album.id,
            title,
            albumUrl,
        });

        const { cardId, cardUrl } = await createEventCard(
            title,
            getDateString(input.eventDate),
            input.description,
            trelloKey,
        );
        undos.push(() => archiveCard(cardId, trelloKey));

        // No undo needed: the card this edits is archived by the undo above.
        await addAlbumLinkToCard(cardId, albumUrl, trelloKey);

        const eventId = await createEvent({
            title,
            description: input.description,
            eventDate: input.eventDate,
            trelloCardId: cardId,
            albumId: album.id,
            albumUrl,
            eventLeader: input.eventLeader,
            zoneLeaders: input.zoneLeaders,
            toolHaulers: input.toolHaulers,
            gloverLover: input.gloverLover,
            notes: input.notes,
            isDraft: false,
        });

        return { eventId, cardId, cardUrl, albumId: album.id, albumUrl };
    } catch (error) {
        throw new EventSetupError(getErrorMessage(error), await unwind());
    }
}
