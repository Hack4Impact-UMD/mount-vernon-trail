import { parseAndValidateDate } from "@/utils/date";
import type { AxiosInstance } from "axios";
import axios from "axios";
import type { Board, Card, EventCard, List } from "./trello-types";

export class TrelloClient {
    private readonly client: AxiosInstance;
    private readonly key: string;
    private readonly token: string;

    constructor(key: string, token: string) {
        this.key = key;
        this.token = token;
        this.client = axios.create({
            baseURL: "https://api.trello.com/1",
            params: {
                key: this.key,
                token: this.token,
            },
        });
    }

    async getBoards(): Promise<Board[]> {
        try {
            const response =
                await this.client.get<Board[]>("/members/me/boards");
            return response.data;
        } catch (error) {
            console.error("error finding boards:", error);
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
            console.error(`error getting lists:`, error);
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
            });
            return response.data;
        } catch (error) {
            console.error("unable to create card:", error);
            throw error;
        }
    }

    async getCards(
        listID: string,
        sortByCreationDate: boolean = false,
    ): Promise<Card[]> {
        try {
            const response = await this.client.get<Card[]>(
                `/lists/${listID}/cards`,
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
                cards.sort((a, b) =>
                    a.creationDate > b.creationDate ? -1 : 1,
                );
            }
            return cards;
        } catch (error) {
            console.error("unable to get cards:", error);
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
        removeDate: boolean = false,
    ): Promise<EventCard[]> {
        try {
            const cards = await this.getCards(listID, false);
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
            const result: EventCard[] = cards
                // convert to event cards
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
            console.error("unable to get cards:", error);
            throw error;
        }
    }
}
