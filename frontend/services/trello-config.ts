import { TrelloAuthError } from "./trello-auth-error";
import { TrelloClient } from "./trello-funcs";

// Board and list names are configuration, not code. Defaults preserve today's
// behaviour so nothing changes until the real board is set in the environment.
export const BOARD_NAME =
    process.env.EXPO_PUBLIC_TRELLO_BOARD_NAME ?? "MVT Mock Board";

export type TrelloListSlot =
    | "trailIssues"
    | "upcomingEvents"
    | "completedEvents"
    | "completedIssues";

const LIST_NAMES: Record<TrelloListSlot, string> = {
    trailIssues:
        process.env.EXPO_PUBLIC_TRELLO_TRAIL_ISSUES_LIST ??
        "Trail Issues and Problems - Intake",
    upcomingEvents:
        process.env.EXPO_PUBLIC_TRELLO_UPCOMING_EVENTS_LIST ?? "Scheduled Events",
    completedEvents:
        process.env.EXPO_PUBLIC_TRELLO_COMPLETED_EVENTS_LIST ??
        "Completed Events (From App)",
    completedIssues:
        process.env.EXPO_PUBLIC_TRELLO_COMPLETED_ISSUES_LIST ?? "Completed Issues",
};

type BoardCache = {
    boardId: string;
    listIds: Record<TrelloListSlot, string>;
    fetchedAt: number;
};

const CACHE_TTL_MS = 15 * 60 * 1000;

let cache: BoardCache | null = null;
let inflight: Promise<BoardCache> | null = null;
let client: TrelloClient | null = null;
let clientKey = "";

export function getTrelloClient(key: string): TrelloClient {
    if (!client || clientKey !== key) {
        client = new TrelloClient(key);
        clientKey = key;
    }
    return client;
}

export function invalidateTrelloCache(): void {
    cache = null;
    inflight = null;
    client = null;
    clientKey = "";
}

async function loadBoardCache(key: string): Promise<BoardCache> {
    const trello = getTrelloClient(key);
    const boards = await trello.getBoards();
    const board = boards.find((b) => b.name === BOARD_NAME);
    if (!board) throw new Error(`Board "${BOARD_NAME}" not found`);

    const lists = await trello.getLists(board.id);
    const listIds = {} as Record<TrelloListSlot, string>;
    for (const slot of Object.keys(LIST_NAMES) as TrelloListSlot[]) {
        const name = LIST_NAMES[slot];
        const list = lists.find((l) => l.name === name);
        if (!list) {
            throw new Error(`List "${name}" not found on board "${BOARD_NAME}"`);
        }
        listIds[slot] = list.id;
    }
    return { boardId: board.id, listIds, fetchedAt: Date.now() };
}

// Every Trello operation used to re-fetch /members/me/boards and
// /boards/{id}/lists from scratch — a publish did it three times. Cached for
// the session, single-flighted, and never populated from a failed load.
async function getBoardCache(key: string): Promise<BoardCache> {
    if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) return cache;
    if (inflight) return inflight;

    inflight = loadBoardCache(key);
    try {
        cache = await inflight;
        return cache;
    } catch (error) {
        // A token change invalidates the client as well as the ids.
        if (error instanceof TrelloAuthError) invalidateTrelloCache();
        throw error;
    } finally {
        inflight = null;
    }
}

export async function getBoardId(key: string): Promise<string> {
    return (await getBoardCache(key)).boardId;
}

export async function getListId(
    slot: TrelloListSlot,
    key: string,
): Promise<string> {
    return (await getBoardCache(key)).listIds[slot];
}

export async function warmTrelloCache(key: string): Promise<void> {
    await getBoardCache(key);
}
