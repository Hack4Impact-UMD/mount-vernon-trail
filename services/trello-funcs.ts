import { parseAndValidateDate } from "@/utils/date";
import type { AxiosInstance, InternalAxiosRequestConfig } from "axios";
import axios from "axios";
import {getTrelloToken} from "../auth/trello-token-storage";
import { TrelloAuthError } from "./trello-auth-error";
import type { Board, Card, EventCard, List } from "./trello-types";


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
                    config.params = {
                        ...config.params,
                        key: this.key,
                        token,
                    }
                    return config;
                } catch (error:any) {
                    if(error instanceof TrelloAuthError){
                        throw error;
                    }
                    throw new TrelloAuthError("AUTH_FAILED");
                }
            }
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
        getAttachments: boolean = false,
    ): Promise<Card[]> {
        try {
            const response = await this.client.get<Card[]>(
                `/lists/${listID}/cards${getAttachments ? "?attachments=cover" : ""}`,
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
            console.error("unable to get cards:", getErrorMessage(error));
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

            console.error(`unable to get card ${cardID}:`, getErrorMessage(error));
            throw error;
        }
    }

    async updateCardDescription(
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

            console.error(`unable to update card ${cardID}:`, getErrorMessage(error));
            throw error;
        }
    }

    async loadTrelloImage(imageUrl: string): Promise<string | null> {
        try {
            const token = await getTrelloToken();
            const response = await fetch(imageUrl, {
                method: "GET",
                headers: {
                    Authorization: `OAuth oauth_consumer_key="${this.key}", oauth_token="${token}"`,
                },
            });
            if (!response.ok) {
                if (response.status === 401) throw new TrelloAuthError("TOKEN_EXPIRED");
                if (response.status === 403) throw new TrelloAuthError("PERMISSION_DENIED");
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
