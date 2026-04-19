// test-trello.ts
//
// This integration test requires the Expo runtime (expo-secure-store)
// and cannot be run directly with Node.js / ts-node.
//
// fetchTrailIssues and fetchUpcomingEvents now resolve tokens from
// expo-secure-store internally, so they cannot be called outside Expo.
//
// See frontend/scripts/test-trello-auth.ts for Node-compatible unit tests.

console.error(
    "ERROR: This test requires the Expo runtime (expo-secure-store).\n" +
        "It cannot be run with Node.js / ts-node.\n" +
        "Run integration tests within the Expo app instead.",
);
process.exit(1);
