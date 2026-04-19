// Tests for TrelloAuthError and error messages.
//
// TrelloClient integration tests (API calls, auth flow) cannot run in Node.js
// because TrelloClient resolves tokens from expo-secure-store.
// Those tests must be run within the Expo runtime.

import {
    TrelloAuthError,
    TRELLO_ERROR_MESSAGES,
} from "../services/trello-auth-error";

async function main() {
    let passed = 0;
    let failed = 0;

    // Test 1: Error messages all exist and are non-empty
    console.log("--- Test 1: Error message strings ---");
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

    // Test 2: TrelloAuthError constructor sets code and message correctly
    console.log("\n--- Test 2: TrelloAuthError constructor ---");
    try {
        const err = new TrelloAuthError("TOKEN_EXPIRED");
        const ok =
            err.code === "TOKEN_EXPIRED" &&
            err.message === TRELLO_ERROR_MESSAGES["TOKEN_EXPIRED"] &&
            err.name === "TrelloAuthError" &&
            err instanceof Error;
        if (ok) {
            console.log(
                "PASS — code, message, name, and prototype chain correct",
            );
            passed++;
        } else {
            console.log("FAIL — unexpected properties:", {
                code: err.code,
                message: err.message,
                name: err.name,
            });
            failed++;
        }
    } catch (e) {
        console.log("FAIL —", e);
        failed++;
    }

    // Test 3: TrelloAuthError with custom message overrides default
    console.log("\n--- Test 3: TrelloAuthError custom message ---");
    try {
        const custom = "Custom error message";
        const err = new TrelloAuthError("AUTH_FAILED", custom);
        if (err.message === custom && err.code === "AUTH_FAILED") {
            console.log("PASS — custom message used");
            passed++;
        } else {
            console.log("FAIL —", {
                message: err.message,
                code: err.code,
            });
            failed++;
        }
    } catch (e) {
        console.log("FAIL —", e);
        failed++;
    }

    console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
    if (failed > 0) {
        process.exit(1);
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
