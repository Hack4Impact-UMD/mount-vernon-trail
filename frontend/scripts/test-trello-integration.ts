// test-trello-integration.ts
//
// This integration test requires the Expo runtime (expo-secure-store)
// and cannot be run directly with Node.js / ts-node.
//
// TrelloClient now resolves tokens from expo-secure-store internally,
// so it cannot be instantiated outside the Expo runtime.
//
// See frontend/scripts/test-trello-auth.ts for Node-compatible unit tests.

console.error(
    "ERROR: This test requires the Expo runtime (expo-secure-store).\n" +
        "It cannot be run with Node.js / ts-node.\n" +
        "Run integration tests within the Expo app instead.",
);
process.exit(1);
