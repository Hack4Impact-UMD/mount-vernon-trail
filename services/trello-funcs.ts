import { parseAndValidateDate } from "@/utils/date";
import type { AxiosInstance, InternalAxiosRequestConfig } from "axios";
import axios from "axios";
import type { Board, Card, EventCard, List } from "./trello-types";
import { TrelloAuthError } from "./trello-auth-error";

export class TrelloClient {
    private readonly client: AxiosInstance;
    private readonly key: string;
    private token: string; // no longer readonly!!

    constructor(key: string, token: string) {
        this.key = key;
        this.token = token;
        this.client = axios.create({
            baseURL: "https://api.trello.com/1",
        });

        
        // params on axios.create(). This lets us swap the token without rebuilding the client.
        this.client.interceptors.request.use(
            (config: InternalAxiosRequestConfig) => {
                config.params = {
                    ...config.params,
                    key: this.key,
                    token: this.token,
                };
                return config;
            },
        );

        // Map HTTP auth failures to typed TrelloAuthError so callers can know what error for what
        this.client.interceptors.response.use(
            (response) => response,
            (error: unknown) => {
                if (axios.isAxiosError(error)) {
                    if (error.response?.status === 401) {
                        throw new TrelloAuthError("TOKEN_EXPIRED");
                    }
                    if (error.response?.status === 403) {
                        throw new TrelloAuthError("PERMISSION_DENIED");
                    }
                    if (!error.response) {
                        throw new TrelloAuthError("NETWORK_ERROR");
                    }
                }
                throw error;
            },
        );
    }

    /**
     * Replace the current token (e.g. after re-authentication).
     * The new token will be used for all subsequent requests.
     */
    updateToken(newToken: string): void {
        this.token = newToken;
    }

    async getBoards(): Promise<Board[]> {
        try {
            const response =
                await this.client.get<Board[]>("/members/me/boards");
            return response.data;
        } catch (error) {
            if (error instanceof TrelloAuthError) throw error;
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
            if (error instanceof TrelloAuthError) throw error;
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
            if (error instanceof TrelloAuthError) throw error;
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
            console.error("unable to get cards:", error);
            throw error;
        }
    }

    private static cardToEventCard(
        card: Card,
        removeDate: boolean,
    ): EventCard | null {
        const [date, ...rest] = card.name.split(" ");
        const eventDate = parseAndValidateDate(date);
        if (!eventDate) {
            return null;
        }
        const eventCard: EventCard = {
            ...card,
            name: removeDate ? rest.join(" ") : card.name,
            eventDate,
        };
        return eventCard;
    }

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
                .map((card) => TrelloClient.cardToEventCard(card, removeDate))
                .filter(
                    (card): card is EventCard =>
                        card !== null &&
                        card.eventDate >= today &&
                        card.eventDate <= futureDate,
                )
                .sort((a, b) => a.eventDate.getTime() - b.eventDate.getTime());
            return result;
        } catch (error) {
            if (error instanceof TrelloAuthError) throw error;
            console.error("unable to get cards:", error);
            throw error;
        }
    }
}