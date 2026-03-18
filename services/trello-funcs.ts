import { parseAndValidateDate } from "@/utils/date";
import type { AxiosInstance } from "axios";
import axios from "axios";
import type { Board, Card, List } from "./trello-types";

export class TrelloClient {
    private client: AxiosInstance;
    private key: string;
    private token: string;

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

    // get cards that are within the next X days (only applicable for Upcoming Events list)
    // includes option to remove date from card name (for display only)
    async getCardsFiltered(
        listID: string,
        days: number = 30,
        removeDate: boolean = false,
    ): Promise<Card[]> {
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
            const result = cards
                .filter((card) => {
                    // get card date from name
                    const [date] = card.name.split(" ");
                    const result = parseAndValidateDate(date);
                    if (result === null) {
                        return false;
                    }
                    const dueDate = result;
                    return dueDate >= today && dueDate <= futureDate;
                })
                // sort by date ascending
                .sort((a, b) => {
                    const [dateA] = a.name.split(" ");
                    const [dateB] = b.name.split(" ");
                    return dateA < dateB ? -1 : 1;
                });
            return removeDate
                ? result.map((card) => {
                      card.name = card.name.split(" ").slice(1).join(" ");
                      return card;
                  })
                : result;
        } catch (error) {
            console.error("unable to get cards:", error);
            throw error;
        }
    }
}
