import * as dotenv from "dotenv";
import { TrelloClient } from "../services/trello-funcs";

dotenv.config();

const API_KEY = process.env.TRELLO_API_KEY;
const API_TOKEN = process.env.TRELLO_API_TOKEN;

if (!API_KEY || !API_TOKEN) {
    console.error("Issue with API Key or Token");
    process.exit(1);
}

const trello = new TrelloClient(API_KEY, API_TOKEN);

async function Card(
    boardName: string,
    listName: string,
    cardName: string,
    cardDescription: string,
) {
    const boards = await trello.getBoards();
    const targetBoard = boards.find((board) => board.name === boardName);

    if (!targetBoard) {
        console.error("board name not found");
        return;
    }

    console.log(`\nfound board: ${targetBoard.name}`);

    const lists = await trello.getLists(targetBoard.id);

    if (lists.length > 0) {
        const targetList = lists.find((list) => list.name === listName);

        if (!targetList) {
            console.error("list name not found");
            return;
        }

        console.log(`found list: ${targetList.name}`);

        await trello.createCard(targetList.id, cardName, cardDescription);
        console.log(`success!`);
    } else {
        console.log("No lists in this board");
    }
}

async function listIssues(boardName: string, listName: string) {
    const boards = await trello.getBoards();
    const targetBoard = boards.find((board) => board.name === boardName);
    if (!targetBoard) {
        console.error("board name not found");
        return;
    }
    const lists = await trello.getLists(targetBoard.id);
    if (lists.length > 0) {
        const targetList = lists.find((list) => list.name === listName);
        if (!targetList) {
            console.error("list name not found");
            return;
        }
        const cards = await trello.getCards(targetList.id);
        console.log(`Cards in list "${targetList.name}":`);
        for (const card of cards) {
            console.log(`- ${card.name}: ${card.desc || "No description"}`);
        }
        console.log();
    }
}

async function listEvents(
    boardName: string,
    listName: string,
    removeDate: boolean = false,
) {
    const boards = await trello.getBoards();
    const targetBoard = boards.find((board) => board.name === boardName);
    if (!targetBoard) {
        console.error("board name not found");
        return;
    }
    const lists = await trello.getLists(targetBoard.id);
    if (lists.length > 0) {
        const targetList = lists.find((list) => list.name === listName);
        if (!targetList) {
            console.error("list name not found");
            return;
        }
        const days = 30;
        const cards = await trello.getCardsFiltered(
            targetList.id,
            days,
            removeDate,
        );
        console.log(`Cards in list "${targetList.name}" (${days} days):`);
        for (const card of cards) {
            console.log(`- ${card.name}: ${card.desc}`);
        }
        console.log();
    }
}

(async () => {
    // Card("MVT Mock Board", "Today", "clean up trail 5", "pick up trash");
    await listIssues("MVT Mock Board", "Trail Issues and Problems - Intake");
    await listEvents("MVT Mock Board", "Scheduled Events", true);
    await listEvents("MVT Mock Board", "Scheduled Events", false);
})();
