import { parseAndValidateDate } from "@/utils/date";
import type { AxiosInstance, InternalAxiosRequestConfig } from "axios";
import axios from "axios";
import { getTrelloToken } from "../auth/trello-token-storage";
import { TrelloAuthError } from "./trello-auth-error";
import type {
    Board,
    Card,
    EventCard,
    List,
    TrelloAttachment,
} from "./trello-types";

// helper for error message from unknown error type
function getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    if (typeof error === "string") {
        return error;
    }
    return String(error) || "Unknown error";
}

function isTrelloHost(url: string): boolean {
    try {
        const { hostname } = new URL(url);
        return (
            hostname === "trello.com" ||
            hostname.endsWith(".trello.com") ||
            hostname.endsWith(".trellousercontent.com") ||
            hostname === "trello-attachments.s3.amazonaws.com"
        );
    } catch {
        return false;
    }
}

function handleHttpError(status: number): void {
    if (status === 401) {
        throw new TrelloAuthError("TOKEN_EXPIRED");
    }
    if (status === 403) {
        throw new TrelloAuthError("PERMISSION_DENIED");
    }
}
export class TrelloClient {
    private readonly client: AxiosInstance;
    private readonly key: string;

    constructor(key: string) {
        this.key = key;
        this.client = axios.create({
            baseURL: "https://api.trello.com/1",
        });

        // attach api key and token to every request
        this.client.interceptors.request.use(
            async (config: InternalAxiosRequestConfig) => {
                try {
                    const token = await getTrelloToken();
                    if (!token) {
                        throw new TrelloAuthError("AUTH_FAILED");
                    }
                    config.params = {
                        ...config.params,
                        key: this.key,
                        token,
                    };
                    return config;
                } catch (error: any) {
                    if (error instanceof TrelloAuthError) {
                        throw error;
                    }
                    throw new TrelloAuthError("AUTH_FAILED");
                }
            },
        );
        // map http auth failures to typed TrelloAuthError
        this.client.interceptors.response.use(
            (response) => response,
            (error: unknown) => {
                if (axios.isAxiosError(error)) {
                    if (error.response?.status) {
                        handleHttpError(error.response.status);
                        // non-auth status, re-throw original
                        throw error;
                    }
                    if (!error.response) {
                        throw new TrelloAuthError("NETWORK_ERROR");
                    }
                    throw error;
                }
                throw error;
            },
        );
    }

    async getBoards(): Promise<Board[]> {
        try {
            const response =
                await this.client.get<Board[]>("/members/me/boards");
            return response.data;
        } catch (error) {
            if (error instanceof TrelloAuthError) throw error;
            console.error("error finding boards:", getErrorMessage(error));
            throw error;
        }
    }

    async getLists(boardID: string): Promise<List[]> {
        try {
            const response = await this.client.get<List[]>(
                `/boards/${boardID}/lists`,
            );
            return response.data;
        } catch (error) {
            if (error instanceof TrelloAuthError) throw error;

            console.error(`error getting lists:`, getErrorMessage(error));
            throw error;
        }
    }

    async createCard(
        listID: string,
        name: string,
        description?: string,
    ): Promise<Card> {
        try {
            const response = await this.client.post<Card>("/cards", {
                idList: listID,
                name: name,
                desc: description || "",
                fields: "id,name,desc,idList,idBoard,shortUrl",
            });
            return response.data;
        } catch (error) {
            if (error instanceof TrelloAuthError) throw error;
            console.error("unable to create card:", getErrorMessage(error));
            throw error;
        }
    }

    async getCards(
        listID: string,
        sortByCreationDate: boolean = false,
        getAttachments: boolean | "cover" = false,
    ): Promise<Card[]> {
        try {
            const response = await this.client.get<Card[]>(
                `/lists/${listID}/cards?attachments=${getAttachments}`,
            );
            // map to get the creation time
            // reference: https://support.atlassian.com/trello/docs/getting-the-time-a-card-or-board-was-created/
            const cards = response.data.map((card) => {
                card.creationDate = new Date(
                    1000 * Number.parseInt(card.id.substring(0, 8), 16),
                );
                return card;
            });
            if (sortByCreationDate) {
                cards.sort(
                    (a, b) =>
                        b.creationDate.getTime() - a.creationDate.getTime(),
                );
            }
            return cards;
        } catch (error) {
            if (error instanceof TrelloAuthError) throw error;
            console.error("unable to get cards:", getErrorMessage(error));
            throw error;
        }
    }

    // Attempt to convert card to event card
    // If date cannot be parsed from the begining of the card name, return null
    private static cardToEventCard(
        card: Card,
        removeDate: boolean,
    ): EventCard | null {
        // get card date from name
        const [date, ...rest] = card.name.split(" ");
        const eventDate = parseAndValidateDate(date);
        // if date is invalid, return null (not a valid event card)
        if (!eventDate) {
            return null;
        }
        const eventCard: EventCard = {
            ...card,
            // remove date from name if removeDate is true
            name: removeDate ? rest.join(" ") : card.name,
            eventDate,
        };
        return eventCard;
    }

    // get cards that are within the next X days (only applicable for Upcoming Events list)
    // includes option to remove date from card name (for display only)
    async getEventCardsFiltered(
        listID: string,
        days: number = 30,
        getAttachments: boolean = false,
        removeDate: boolean = false,
    ): Promise<EventCard[]> {
        try {
            const cards = await this.getCards(listID, false, getAttachments);
            const now = new Date();
            const today = new Date(
                now.getFullYear(),
                now.getMonth(),
                now.getDate(),
            );
            const daysMilliseconds = 24 * 60 * 60 * 1000;
            const futureDate = new Date(
                today.getTime() + days * daysMilliseconds,
            );
            // convert to event cards
            const result: EventCard[] = cards
                .map((card) => TrelloClient.cardToEventCard(card, removeDate))
                .filter(
                    (card): card is EventCard =>
                        card !== null &&
                        card.eventDate >= today &&
                        card.eventDate <= futureDate,
                )
                // sort by date ascending
                .sort((a, b) => a.eventDate.getTime() - b.eventDate.getTime());
            return result;
        } catch (error) {
            if (error instanceof TrelloAuthError) throw error;

            console.error("unable to get cards:", getErrorMessage(error));
            throw error;
        }
    }

    async getCard(cardID: string): Promise<Card> {
        try {
            const response = await this.client.get<Card>(`/cards/${cardID}`);
            return response.data;
        } catch (error) {
            if (error instanceof TrelloAuthError) throw error;
            console.error(
                `unable to get card ${cardID}:`,
                getErrorMessage(error),
            );
            throw error;
        }
    }

    async moveCardToList(cardID: string, listID: string): Promise<void> {
        try {
            await this.client.put(`/cards/${cardID}`, { idList: listID });
        } catch (error) {
            if (error instanceof TrelloAuthError) throw error;
            console.error(
                `unable to move card ${cardID}:`,
                getErrorMessage(error),
            );
            throw error;
        }
    }

    async replaceCardDescription(
        cardID: string,
        newDescription: string,
    ): Promise<Card> {
        try {
            const response = await this.client.put<Card>(`/cards/${cardID}`, {
                desc: newDescription,
            });
            return response.data;
        } catch (error) {
            if (error instanceof TrelloAuthError) throw error;
            console.error(
                `unable to update card ${cardID}:`,
                getErrorMessage(error),
            );
            throw error;
        }
    }

    async appendCardDescription(
        cardID: string,
        newDescription: string,
    ): Promise<Card> {
        try {
            const card = await this.getCard(cardID);
            const existingDescription = card.desc;

            const response = await this.client.put<Card>(`/cards/${cardID}`, {
                desc:
                    existingDescription !== ""
                        ? `${existingDescription}\n${newDescription}`
                        : newDescription,
            });

            return response.data;
        } catch (error) {
            if (error instanceof TrelloAuthError) throw error;
            console.error(
                `unable to update card ${cardID}:`,
                getErrorMessage(error),
            );
            throw error;
        }
    }

    // extract card ID from attachment url (so it can be fetched separately / collected for filtering)
    // returns null if url is not a Trello card url
    private static extractCardIDFromAttachment(
        attachment: TrelloAttachment,
    ): string | null {
        const regex = /https:\/\/trello\.com\/c\/(.+?)\//;
        const match = regex.exec(attachment.url);
        return match ? match[1] : null;
    }

    // gets (issue) card IDs that are attachments to an event card
    async getEventCardAttachmentIDs(eventCard: EventCard): Promise<string[]> {
        if (!eventCard.attachments) {
            return [];
        }
        const cardIDs: string[] = [];
        for (const attachment of eventCard.attachments) {
            const cardID = TrelloClient.extractCardIDFromAttachment(attachment);
            if (cardID) {
                cardIDs.push(cardID);
            }
        }
        return cardIDs;
    }

    async getCardByID(
        cardID: string,
        getAttachments: boolean | "cover" = false,
    ): Promise<Card> {
        try {
            const response = await this.client.get<Card>(
                `/cards/${cardID}?attachments=${getAttachments}`,
            );
            const card = response.data;
            card.creationDate = new Date(
                1000 * Number.parseInt(card.id.substring(0, 8), 16),
            );
            return card;
        } catch (error) {
            console.error("unable to get card:", error);
            throw error;
        }
    }

    async getEventCardByID(
        cardID: string,
        getAttachments: boolean | "cover" = false,
    ): Promise<EventCard> {
        try {
            const card = await this.getCardByID(cardID, getAttachments);
            const eventCard = TrelloClient.cardToEventCard(card, true);
            if (!eventCard) {
                throw new Error(
                    `Card with ID "${cardID}" is not a valid event card`,
                );
            }
            return eventCard;
        } catch (error) {
            console.error("unable to get event card:", error);
            throw error;
        }
    }

    async loadTrelloImage(imageUrl: string): Promise<string | null> {
        try {
            const headers: Record<string, string> = {};

            if (isTrelloHost(imageUrl)) {
                const token = await getTrelloToken();
                if (!token) {
                    throw new TrelloAuthError("AUTH_FAILED");
                }
                headers.Authorization = `OAuth oauth_consumer_key="${this.key}", oauth_token="${token}"`;
            }

            const response = await fetch(imageUrl, {
                method: "GET",
                headers,
            });
            if (!response.ok) {
                if (response.status === 401)
                    throw new TrelloAuthError("TOKEN_EXPIRED");
                if (response.status === 403)
                    throw new TrelloAuthError("PERMISSION_DENIED");
                throw new Error(`Failed to fetch image: ${response.status}`);
            }
            const blob = await response.blob();
            // convert blob to base64 string
            return await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    resolve(reader.result as string);
                };
                reader.onerror = () => {
                    reject(new Error("Failed to convert blob to Base64"));
                };
                reader.readAsDataURL(blob);
            });
        } catch (error) {
            if (error instanceof TrelloAuthError) throw error;

            console.error("Error loading image:", error);
            return null;
        }
    }
}
