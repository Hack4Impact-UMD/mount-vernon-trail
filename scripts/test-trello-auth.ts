import * as dotenv from "dotenv";
dotenv.config();

import { TrelloClient } from "../services/trello-funcs";
import { TrelloAuthError, TRELLO_ERROR_MESSAGES } from "../services/trello-auth-error";

const API_KEY = process.env.EXPO_PUBLIC_TRELLO_API_KEY;
const API_TOKEN = process.env.EXPO_PUBLIC_TRELLO_API_TOKEN;

if (!API_KEY || !API_TOKEN) {
    console.error("Missing API Key or Token in .env");
    process.exit(1);
}

async function main() {
    let passed = 0;
    let failed = 0;

    // Test 1: Refactored client still works with valid credentials
    console.log("--- Test 1: Client works with valid token ---");
    try {
        const client = new TrelloClient(API_KEY!, API_TOKEN!);
        const boards = await client.getBoards();
        console.log(`PASS — found ${boards.length} boards`);
        passed++;
    } catch (e) {
        console.log("FAIL —", e);
        failed++;
    }

    // Test 2: updateToken works
    console.log("\n--- Test 2: updateToken keeps client working ---");
    try {
        const client = new TrelloClient(API_KEY!, "placeholder");
        client.updateToken(API_TOKEN!);
        const boards = await client.getBoards();
        console.log(`PASS — found ${boards.length} boards after updateToken`);
        passed++;
    } catch (e) {
        console.log("FAIL —", e);
        failed++;
    }

    // Test 3: Bad token throws TrelloAuthError with TOKEN_EXPIRED
    console.log("\n--- Test 3: Bad token throws TrelloAuthError ---");
    try {
        const client = new TrelloClient(API_KEY!, "bad-token-12345");
        await client.getBoards();
        console.log("FAIL — should have thrown");
        failed++;
    } catch (e) {
        if (e instanceof TrelloAuthError) {
            console.log(`PASS — TrelloAuthError code: ${e.code}`);
            console.log(`  Message: ${e.message}`);
            passed++;
        } else {
            console.log("FAIL — wrong error type:", e);
            failed++;
        }
    }

    // Test 4: updateToken recovers a bad client
    console.log("\n--- Test 4: updateToken recovers from bad token ---");
    try {
        const client = new TrelloClient(API_KEY!, "bad-token");
        try {
            await client.getBoards();
        } catch {
            // expected to fail
        }
        client.updateToken(API_TOKEN!);
        const boards = await client.getBoards();
        console.log(`PASS — recovered, found ${boards.length} boards`);
        passed++;
    } catch (e) {
        console.log("FAIL —", e);
        failed++;
    }

    // Test 5: Error messages all exist and are non-empty
    console.log("\n--- Test 5: Error message strings ---");
    const codes: Array<keyof typeof TRELLO_ERROR_MESSAGES> = [
        "TOKEN_EXPIRED",
        "PERMISSION_DENIED",
        "NETWORK_ERROR",
        "AUTH_CANCELLED",
        "AUTH_FAILED",
    ];
    let allPresent = true;
    for (const code of codes) {
        const msg = TRELLO_ERROR_MESSAGES[code];
        if (!msg || msg.length === 0) {
            console.log(`FAIL — missing message for ${code}`);
            allPresent = false;
        }
    }
    if (allPresent) {
        console.log("PASS — all error messages present");
        for (const code of codes) {
            console.log(`  ${code}: "${TRELLO_ERROR_MESSAGES[code]}"`);
        }
        passed++;
    } else {
        failed++;
    }

    // Test 6: Existing functionality — getCards, createCard
    console.log("\n--- Test 6: Existing methods still work ---");
    try {
        const client = new TrelloClient(API_KEY!, API_TOKEN!);
        const boards = await client.getBoards();
        const board = boards.find((b) => b.name === "MVT Mock Board");
        if (!board) throw new Error("MVT Mock Board not found");

        const lists = await client.getLists(board.id);
        const list = lists.find((l) => l.name === "Trail Issues and Problems - Intake");
        if (!list) throw new Error("Trail Issues list not found");

        const cards = await client.getCards(list.id, true);
        console.log(`PASS — getCards returned ${cards.length} cards`);
        passed++;
    } catch (e) {
        console.log("FAIL —", e);
        failed++;
    }

    console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
}

main().catch(console.error);